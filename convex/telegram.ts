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
      text = update.message.text?.trim();
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
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("properties", {
      userId: args.userId,
      transactionType: args.transactionType,
      propertyType: args.propertyType,
      pricing: {
        expectedPrice: args.price,
      },
      location: {
        city: "",
        state: "",
        locality: args.location.address || "",
        address: args.location.address || "",
      },
      details: args.details,
      amenities: [],
      photos: [],
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
      if (["Buy", "Rent"].includes(text)) {
        await ctx.runMutation(internal.telegram.updateState, { 
          chatId, step: "propertyType", data: { transactionType: text } 
        });
        await sendMessage(chatId, "Great! Now, what is the property type?", {
          reply_markup: {
            inline_keyboard: [
              [{ text: "Apartment", callback_data: "Apartment" }, { text: "House", callback_data: "House" }], 
              [{ text: "Plot", callback_data: "Plot" }, { text: "Commercial", callback_data: "Commercial" }]
            ]
          }
        });
      } else {
        await sendMessage(chatId, "Please select one of the options below ⬇️", {
          reply_markup: {
            inline_keyboard: [[
              { text: "Buy (Sell)", callback_data: "Buy" }, 
              { text: "Rent", callback_data: "Rent" }
            ]]
          }
        });
      }
      break;
    
    case "propertyType":
      const validPropType = ["Apartment", "House", "Plot", "Commercial", "Flat"].includes(text);
      if (validPropType) {
        let nextStep = "location";
        let msg = "Where is the property located? You can type the address or share your location 📍";
        let markup: any = {
          inline_keyboard: [[{ text: "Share Location", request_location: true }]] // Note: Inline buttons can't request location in the same way as keyboard buttons usually
        };
        // For location, we might actually need a regular keyboard or just ask them to type
        // Let's stick to regular keyboard for Location as it has "request_location"
        let useRegularKeyboard = false;

        if (["Apartment", "House", "Flat"].includes(text)) {
          nextStep = "bhk";
          msg = "How many BHK? 🏠";
          markup = {
            inline_keyboard: [
              [{ text: "1 BHK", callback_data: "1 BHK" }, { text: "2 BHK", callback_data: "2 BHK" }], 
              [{ text: "3 BHK", callback_data: "3 BHK" }, { text: "4+ BHK", callback_data: "4+ BHK" }]
            ]
          };
        } else {
          useRegularKeyboard = true;
          markup = {
            keyboard: [[{ text: "Share Location", request_location: true }]],
            one_time_keyboard: true, resize_keyboard: true
          };
        }

        await ctx.runMutation(internal.telegram.updateState, { 
          chatId, step: nextStep, data: { propertyType: text === "Apartment" ? "Flat" : text } 
        });
        await sendMessage(chatId, msg, { reply_markup: markup });
      } else {
        await sendMessage(chatId, "Please select the property type from the buttons below ⬇️", {
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
        chatId, step: "location", data: { bhk: text.split(" ")[0] } 
      });
      await sendMessage(chatId, "Where is the property located? You can type the address or share your location 📍", {
        reply_markup: {
          keyboard: [[{ text: "Share Location", request_location: true }]],
          one_time_keyboard: true, resize_keyboard: true
        }
      });
      break;

    case "location":
      const isLocation = !!update.message?.location;
      const locData = isLocation
        ? { lat: update.message.location.latitude, lng: update.message.location.longitude, address: "Location shared via GPS" }
        : { address: text };
      
      await ctx.runMutation(internal.telegram.updateState, { 
        chatId, step: "price", data: { location: locData } 
      });
      await sendMessage(chatId, "What is the expected price/rent in Rupees? (e.g., 4500000 or 15000)");
      break;

    case "price":
      const priceNum = parseInt(text.replace(/,/g, ""));
      if (isNaN(priceNum)) {
        await sendMessage(chatId, "Please enter a valid number for the price.");
        return;
      }
      await ctx.runMutation(internal.telegram.updateState, { 
        chatId, step: "finish", data: { price: priceNum } 
      });
      const summary = `Summary of your listing:\n- ${data.transactionType} ${data.propertyType}\n- BHK: ${data.bhk || "N/A"}\n- Price: ₹${priceNum.toLocaleString("en-IN")}\n\nConfirm to post?`;
      await sendMessage(chatId, summary, {
        reply_markup: {
          inline_keyboard: [[
            { text: "Confirm ✅", callback_data: "Confirm ✅" }, 
            { text: "Cancel ❌", callback_data: "Cancel ❌" }
          ]]
        }
      });
      break;

    case "finish":
      if (text === "Confirm ✅") {
        const user = await ctx.runQuery(internal.telegram.getUserByChatId, { chatId });
        if (!user) {
          await sendMessage(chatId, "Account error. Please try linking again.");
          return;
        }

        await ctx.runMutation(internal.telegram.createTelegramProperty, {
          userId: user._id,
          transactionType: data.transactionType.toLowerCase() === "buy" ? "sell" : "rent",
          propertyType: data.propertyType,
          price: data.price,
          location: data.location,
          details: { bhk: data.bhk || "0" }
        });

        await sendMessage(chatId, "🚀 Property posted successfully! You can view it on your dashboard.");
        await ctx.runMutation(internal.telegram.resetState, { chatId });
      } else {
        await sendMessage(chatId, "Listing cancelled.");
        await ctx.runMutation(internal.telegram.resetState, { chatId });
      }
      break;
  }
}

// External API Call Helpers
async function sendMessage(chatId: string, text: string, extra = {}) {
  if (!BOT_TOKEN) return;
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, ...extra }),
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
