import { mutation, query, action, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Link a Telegram Chat ID to a user via their session token
export const linkUser = mutation({
  args: { token: v.string(), chatId: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!session || session.expiresAt < Date.now()) {
      throw new Error("Invalid or expired session");
    }

    await ctx.db.patch(session.userId, {
      telegramChatId: args.chatId,
    });

    return { success: true };
  },
});

// Main handler for incoming Telegram messages (called from http.ts action)
export const handleUpdate = action({
  args: { update: v.any() },
  handler: async (ctx, args) => {
    const update = args.update;
    let chatId: string;
    let text: string | undefined;
    let isCallback = false;

    if (update.callback_query) {
      chatId = String(update.callback_query.message.chat.id);
      text = update.callback_query.data;
      isCallback = true;
      // Alert Telegram we got the callback
      await answerCallbackQuery(update.callback_query.id);
    } else if (update.message) {
      chatId = String(update.message.chat.id);
      if (update.message.photo) {
        text = "_PHOTO_"; // Sentinel for handleFlowStep
      } else {
        text = update.message.text?.trim();
      }
    } else {
      return;
    }

    console.log(`Telegram update from ${chatId}: "${text}" (isCallback: ${isCallback})`);

    // 1. Get user linked to this chatId
    const user = await ctx.runQuery(internal.telegram.getUserByChatId, { chatId });
    
    if (!user) {
      console.log(`User not found for chatId ${chatId}`);
      
      // Check for deep link token or manual 6-digit code
      let codeOrToken = "";
      if (text?.startsWith("/start")) {
        const parts = text.split(" ");
        if (parts.length > 1) codeOrToken = parts[1];
      } else if (text && /^\d{6}$/.test(text)) {
        codeOrToken = text;
      }

      if (codeOrToken) {
        console.log(`Attempting to link chatId ${chatId} with code/token ${codeOrToken.substring(0, 6)}...`);
        const linked = await ctx.runMutation(internal.telegram.linkUserByCodeOrToken, { chatId, codeOrToken });
        
        if (linked) {
          await sendMessage(chatId, "✅ Account linked! You can now post properties by typing /post");
          return;
        } else {
          await sendMessage(chatId, "❌ Link failed. Please check your code or click 'Connect Bot' again from the Dashboard.");
          return;
        }
      }
      
      await sendMessage(chatId, "Welcome! 🏠\nTo list your properties, please link your 24Dismil account.\n\nOption 1: Click 'Connect Bot' in your Dashboard.\nOption 2: Type your 6-digit linking code here.");
      return;
    }

    // 2. Core Bot Logic (Command Handling)
    if (text === "/post" || text === "/start") {
      await ctx.runMutation(internal.telegram.resetState, { chatId });
      await sendMessage(chatId, "Let's post a property! 🏠\nWhat is the transaction type?", {
        reply_markup: {
          inline_keyboard: [[
            { text: "Buy (Sell)", callback_data: "Buy" }, 
            { text: "Rent", callback_data: "Rent" }
          ]]
        }
      });
      return;
    }

    // 3. State-based Flow (if user is in middle of posting)
    const state = await ctx.runQuery(internal.telegram.getState, { chatId });
    if (state) {
      await handleFlowStep(ctx, chatId, state, update, text);
      return;
    }

    await sendMessage(chatId, "Type /post to start a new listing or visit 24Dismil.com for more options.");
  },
});

// --- Internal Functions (Database) ---

export const getUserByChatId = internalQuery({
  args: { chatId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("users")
      .withIndex("by_telegramChatId", (q) => q.eq("telegramChatId", args.chatId))
      .first();
  },
});

export const createTelegramProperty = internalMutation({
  args: {
    userId: v.id("users"),
    transactionType: v.string(),
    propertyType: v.string(),
    price: v.number(),
    location: v.any(),
    details: v.any(),
    photos: v.optional(v.array(v.string())), // storageIds
  },
  handler: async (ctx, args) => {
    // Ensure all mandatory fields from schema.ts are present
    return await ctx.db.insert("properties", {
      userId: args.userId,
      transactionType: args.transactionType,
      propertyType: args.propertyType,
      pricing: {
        expectedPrice: args.price,
      },
      location: {
        city: args.location.city || "",
        state: args.location.state || "",
        locality: args.location.locality || args.location.address || "",
        address: args.location.address || "",
        pinCode: args.location.pinCode || "",
      },
      details: {
        ...args.details,
        builtUpArea: args.details.area || "0",
        propertyStatus: args.details.status || "Ready to Move",
      },
      amenities: [],
      photos: (args.photos || []).map((storageId, index) => ({
        storageId,
        category: "Exterior",
        isCover: index === 0
      })),
      contactDesc: { 
        description: `Posted via Telegram Bot on ${new Date().toLocaleDateString()}` 
      },
      isFeatured: false,
      approvalStatus: "pending",
    });
  },
});

export const generateLinkCode = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (!session) throw new Error("Invalid session");

    // Clear existing codes for this user
    const existing = await ctx.db
      .query("telegramLinkCodes")
      .filter(q => q.eq(q.field("userId"), session.userId))
      .collect();
    for (const codeObj of existing) {
      await ctx.db.delete(codeObj._id);
    }

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    await ctx.db.insert("telegramLinkCodes", {
      userId: session.userId,
      code,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    });

    return code;
  },
});

export const linkUserByCodeOrToken = internalMutation({
  args: { chatId: v.string(), codeOrToken: v.string() },
  handler: async (ctx, args) => {
    const { chatId, codeOrToken } = args;

    // 1. Try linking by 6-digit code
    if (/^\d{6}$/.test(codeOrToken)) {
      const codeRecord = await ctx.db
        .query("telegramLinkCodes")
        .withIndex("by_code", (q) => q.eq("code", codeOrToken))
        .first();

      if (codeRecord && codeRecord.expiresAt > Date.now()) {
        await ctx.db.patch(codeRecord.userId, { telegramChatId: chatId });
        await ctx.db.delete(codeRecord._id);
        return true;
      }
    }

    // 2. Try linking by session token (fallback for deep links)
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", codeOrToken))
      .first();

    if (session) {
      await ctx.db.patch(session.userId, { telegramChatId: chatId });
      return true;
    }

    return false;
  },
});

export const getState = internalQuery({
  args: { chatId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("telegramStates")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .first();
  },
});

export const resetState = internalMutation({
  args: { chatId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("telegramStates")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .first();
    if (existing) await ctx.db.delete(existing._id);
    await ctx.db.insert("telegramStates", {
      chatId: args.chatId,
      step: "transactionType",
      data: {},
      lastUpdated: Date.now(),
    });
  },
});

export const updateState = internalMutation({
  args: { chatId: v.string(), step: v.string(), data: v.any() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("telegramStates")
      .withIndex("by_chatId", (q) => q.eq("chatId", args.chatId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        step: args.step,
        data: { ...existing.data, ...args.data },
        lastUpdated: Date.now(),
      });
    }
  },
});

// --- Flow Engine ---

async function handleFlowStep(ctx: any, chatId: string, state: any, update: any, text: string | undefined) {
  const { step, data } = state;
  if (!text) return;

  switch (step) {
    case "transactionType":
      const txMap: Record<string, string> = { "Buy (Sell)": "Sale", "Rent": "Rent", "PG / Co-living": "PG" };
      const selectedTx = txMap[text] || text;
      
      if (["Sale", "Rent", "PG"].includes(selectedTx)) {
        await ctx.runMutation(internal.telegram.updateState, { 
          chatId, step: "propertyType", data: { transactionType: selectedTx } 
        });
        await sendMessage(chatId, "Great! What is the property type? (Mandatory) 🏠", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Apartment", callback_data: "Apartment" }, { text: "Villa / House", callback_data: "House" }], 
              [{ text: "Plot / Land", callback_data: "Plot" }, { text: "Commercial", callback_data: "Commercial" }],
              [{ text: "PG Room", callback_data: "PG Room" }, { text: "Warehouse", callback_data: "Warehouse" }],
              [{ text: "Hotel / Resort", callback_data: "Hotel" }, { text: "Lodge", callback_data: "Lodge" }]
            ]
          }
        });
      } else {
        await sendMessage(chatId, "Please select the transaction type: (Mandatory) ⬇️", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Buy (Sell)", callback_data: "Buy (Sell)" }, { text: "Rent", callback_data: "Rent" }],
              [{ text: "PG / Co-living", callback_data: "PG / Co-living" }]
            ]
          }
        });
      }
      break;
    
    case "propertyType":
      const validPropType = ["Apartment", "House", "Plot", "Commercial", "PG Room", "Warehouse", "Hotel", "Lodge", "Flat"].includes(text);
      if (validPropType) {
        const pType = text === "Apartment" ? "Flat" : text;
        const isResidential = ["Flat", "House"].includes(pType);
        
        await ctx.runMutation(internal.telegram.updateState, { 
          chatId, step: isResidential ? "bhk" : "status", data: { propertyType: pType } 
        });

        if (isResidential) {
          await sendMessage(chatId, "How many BHK? (Mandatory) 🛌", {
            reply_markup: {
              inline_keyboard: [
                [{ text: "1 RK", callback_data: "1RK" }, { text: "1 BHK", callback_data: "1BHK" }], 
                [{ text: "2 BHK", callback_data: "2BHK" }, { text: "3 BHK", callback_data: "3BHK" }],
                [{ text: "4 BHK", callback_data: "4BHK" }, { text: "4.5 BHK", callback_data: "4.5BHK" }],
                [{ text: "5 BHK", callback_data: "5BHK" }, { text: "Others", callback_data: "Others" }]
              ]
            }
          });
        } else {
          await sendMessage(chatId, "What is the property status? (Mandatory) 🏗️", {
            reply_markup: {
              inline_keyboard: [
                [{ text: "Ready to Move", callback_data: "Ready to Move" }],
                [{ text: "Under Construction", callback_data: "Under Construction" }],
                [{ text: "New Launch", callback_data: "New Launch" }]
              ]
            }
          });
        }
      } else {
        await sendMessage(chatId, "Please select property type from buttons ⬇️", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Apartment", callback_data: "Apartment" }, { text: "House", callback_data: "House" }], 
              [{ text: "Plot", callback_data: "Plot" }, { text: "Commercial", callback_data: "Commercial" }]
            ]
          }
        });
      }
      break;

    case "bhk":
      await ctx.runMutation(internal.telegram.updateState, { 
        chatId, step: "status", data: { bhk: text } 
      });
      await sendMessage(chatId, "What is the property status? (Mandatory) 🏗️", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Ready to Move", callback_data: "Ready to Move" }],
            [{ text: "Under Construction", callback_data: "Under Construction" }],
            [{ text: "New Launch", callback_data: "New Launch" }]
          ]
        }
      });
      break;

    case "status":
      await ctx.runMutation(internal.telegram.updateState, { 
        chatId, step: "area", data: { status: text } 
      });
      await sendMessage(chatId, "What is the Built-up Area in sq.ft? (Mandatory) 📏\n(Example: 1200)");
      break;

    case "area":
      const areaNum = parseInt(text.replace(/[^0-9]/g, ""));
      if (isNaN(areaNum)) {
        await sendMessage(chatId, "Please enter a valid number for area.");
        return;
      }
      await ctx.runMutation(internal.telegram.updateState, { 
        chatId, step: "location", data: { area: areaNum } 
      });
      await sendMessage(chatId, "Where is the property located?\n\nType the **City** (Mandatory) 📍", {
        reply_markup: {
          keyboard: [[{ text: "Share My Location", request_location: true }]],
          one_time_keyboard: true, resize_keyboard: true
        }
      });
      break;

    case "location":
      const isLocUpdate = !!update.message?.location;
      if (isLocUpdate) {
        const loc = update.message.location;
        await ctx.runMutation(internal.telegram.updateState, { 
          chatId, step: "price", data: { location: { lat: loc.latitude, lng: loc.longitude, address: "GPS Location", city: "Shared via GPS" } } 
        });
        await sendMessage(chatId, "What is the expected Price/Rent in Rupees? (Mandatory) 💸\n(Example: 4500000 or 15000)");
      } else {
        await ctx.runMutation(internal.telegram.updateState, { 
          chatId, step: "locality", data: { location: { city: text } } 
        });
        await sendMessage(chatId, "Enter the **Locality / Area** name: (Mandatory) 🏘️");
      }
      break;

    case "locality":
      await ctx.runMutation(internal.telegram.updateState, { 
        chatId, step: "price", data: { location: { ...data.location, locality: text, address: `${text}, ${data.location.city}` } } 
      });
      await sendMessage(chatId, "What is the expected Price/Rent in Rupees? (Mandatory) 💸\n(Example: 4500000 or 15000)");
      break;

    case "price":
      const priceNum = parseInt(text.replace(/[^0-9]/g, ""));
      if (isNaN(priceNum)) {
        await sendMessage(chatId, "Please enter a valid number for price.");
        return;
      }
      await ctx.runMutation(internal.telegram.updateState, { 
        chatId, step: "photos", data: { price: priceNum, photos: [] } 
      });
      await sendMessage(chatId, "Please send one or more photos of the property! (Optional) 📸\n\nClick **'Done ✅'** when you are finished.", {
        reply_markup: {
          inline_keyboard: [[{ text: "Done ✅", callback_data: "Done ✅" }]]
        }
      });
      break;

    case "photos":
      if (text.includes("Done") || text.includes("DONE")) {
        await ctx.runMutation(internal.telegram.updateState, { chatId, step: "finish", data: {} });
        const summary = `📋 *Listing Summary*\n` + 
                        `• Type: ${data.transactionType} ${data.propertyType}\n` +
                        `• Config: ${data.bhk || "N/A"}\n` +
                        `• Status: ${data.status}\n` +
                        `• Area: ${data.area} sq.ft\n` +
                        `• Location: ${data.location.locality || data.location.city}\n` +
                        `• Price: ₹${data.price.toLocaleString("en-IN")}\n` +
                        `• Photos: *${data.photos?.length || 0}* attached\n\n` +
                        `*Confirm to post?*`;
        await sendMessage(chatId, summary, {
          reply_markup: {
            inline_keyboard: [[
              { text: "Confirm ✅", callback_data: "Confirm ✅" }, 
              { text: "Cancel ❌", callback_data: "Cancel ❌" }
            ]]
          }
        });
      } else if (text === "_PHOTO_") {
        const photoArr = update.message.photo;
        const bestPhoto = photoArr[photoArr.length - 1]; // Highest resolution
        const storageId = await downloadAndStoreTelegramPhoto(ctx, bestPhoto.file_id);
        
        if (storageId) {
          const currentPhotos = data.photos || [];
          await ctx.runMutation(internal.telegram.updateState, { 
            chatId, 
            step: "photos", 
            data: { photos: [...currentPhotos, storageId] } 
          });
          const count = currentPhotos.length + 1;
          await sendMessage(chatId, `✅ *Photo received!* (Total: ${count})\n\nSend more photos or click *Done* below.`, {
            reply_markup: {
              inline_keyboard: [[{ text: "Done ✅", callback_data: "Done ✅" }]]
            }
          });
        } else {
          await sendMessage(chatId, "❌ Failed to process that photo. This usually happens if the photo is too large or the bot token is invalid. Please try again.", {
            reply_markup: {
              inline_keyboard: [[{ text: "Done ✅", callback_data: "Done ✅" }]]
            }
          });
        }
      } else {
        await sendMessage(chatId, "Please send a photo or click *Done ✅*.");
      }
      break;

    case "finish":
      if (text.includes("Confirm") || text.includes("CONFIRM")) {
        const user = await ctx.runQuery(internal.telegram.getUserByChatId, { chatId });
        if (!user) {
          await sendMessage(chatId, "Account error. Please link again.");
          return;
        }

        await ctx.runMutation(internal.telegram.createTelegramProperty, {
          userId: user._id,
          transactionType: data.transactionType.toLowerCase() === "sale" || data.transactionType === "Buy" ? "sell" : "rent",
          propertyType: data.propertyType,
          price: data.price,
          location: data.location,
          details: { bhk: data.bhk || "0", status: data.status, area: data.area },
          photos: data.photos
        });

        await sendMessage(chatId, "🚀 **Property posted successfully!**\n\nIt is now visible in your Dashboard with the photos you sent. Our team will review it shortly.");
        await ctx.runMutation(internal.telegram.resetState, { chatId });
      } else {
        await sendMessage(chatId, "Listing cancelled. Type /post to start fresh.");
        await ctx.runMutation(internal.telegram.resetState, { chatId });
      }
      break;
  }
}

// Storage Helpers
async function downloadAndStoreTelegramPhoto(ctx: any, fileId: string): Promise<string | null> {
  try {
    const fileUrl = await getFileUrl(fileId);
    if (!fileUrl) return null;

    const response = await fetch(fileUrl);
    const blob = await response.blob();
    
    // storage.store() is available in actions
    return await ctx.storage.store(blob);
  } catch (err) {
    console.error("Photo download error:", err);
    return null;
  }
}

async function getFileUrl(fileId: string): Promise<string | null> {
  if (!BOT_TOKEN) return null;
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${fileId}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.ok) {
      return `https://api.telegram.org/file/bot${BOT_TOKEN}/${data.result.file_path}`;
    }
  } catch (err) {
    console.error("getFileUrl error:", err);
  }
  return null;
}

// External API Call Helpers
async function sendMessage(chatId: string, text: string, extra = {}) {
  if (!BOT_TOKEN) return;
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        chat_id: chatId, 
        text, 
        parse_mode: "Markdown",
        ...extra 
      }),
    });
  } catch (err) {
    console.error("Telegram sendMessage error:", err);
  }
}

async function answerCallbackQuery(callbackQueryId: string) {
  if (!BOT_TOKEN) return;
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackQueryId }),
    });
  } catch (err) {
    console.error("Telegram answerCallbackQuery error:", err);
  }
}
