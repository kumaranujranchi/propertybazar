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
    if (!update.message) return;

    const chatId = String(update.message.chat.id);
    const text = update.message.text?.trim();
    console.log(`Telegram update from ${chatId}: "${text}"`);

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
        // Try linking by code first, then by token
        const linked = await ctx.runMutation(internal.telegram.linkUserByCodeOrToken, { chatId, codeOrToken });
        
        if (linked) {
          await sendMessage(chatId, "✅ Account linked! You can now post properties by typing /post");
          return;
        } else {
          console.error("Linking failed - invalid or expired code/token");
          await sendMessage(chatId, "❌ Link failed. Please check your code or click 'Connect Bot' again from the Dashboard.");
          return;
        }
      }
      
      await sendMessage(chatId, "Welcome! 🏠\nTo list your properties, please link your 24Dismil account.\n\nOption 1: Click 'Connect Bot' in your Dashboard.\nOption 2: Type your 6-digit linking code here.");
      return;
    }

    // 2. Core Bot Logic (Command Handling)
    // ... rest of the logic remains same
    if (text === "/post") {
      await ctx.runMutation(internal.telegram.resetState, { chatId });
      await sendMessage(chatId, "Let's post a property! 🏠\nWhat is the transaction type?", {
        reply_markup: {
          keyboard: [[{ text: "Buy" }, { text: "Rent" }]],
          one_time_keyboard: true,
          resize_keyboard: true
        }
      });
      return;
    }

    // 3. State-based Flow (if user is in middle of posting)
    const state = await ctx.runQuery(internal.telegram.getState, { chatId });
    if (state) {
      await handleFlowStep(ctx, chatId, state, update);
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

async function handleFlowStep(ctx: any, chatId: string, state: any, update: any) {
  const text = update.message.text;
  const { step, data } = state;

  switch (step) {
    case "transactionType":
      if (["Buy", "Rent"].includes(text)) {
        await ctx.runMutation(internal.telegram.updateState, { 
          chatId, step: "propertyType", data: { transactionType: text } 
        });
        await sendMessage(chatId, "Great! Now, what is the property type?", {
          reply_markup: {
            keyboard: [[{ text: "Flat" }, { text: "House" }], [{ text: "Plot" }, { text: "Commercial" }]],
            one_time_keyboard: true, resize_keyboard: true
          }
        });
      }
      break;
    
    case "propertyType":
      await ctx.runMutation(internal.telegram.updateState, { 
        chatId, step: "location", data: { propertyType: text } 
      });
      await sendMessage(chatId, "Where is the property located? You can type the address or share your location 📍", {
        reply_markup: {
          keyboard: [[{ text: "Share Location", request_location: true }]],
          resize_keyboard: true
        }
      });
      break;

    case "location":
      const locData = update.message.location 
        ? { lat: update.message.location.latitude, lng: update.message.location.longitude }
        : { address: text };
      
      await ctx.runMutation(internal.telegram.updateState, { 
        chatId, step: "price", data: { location: locData } 
      });
      await sendMessage(chatId, "What is the expected price/rent in Rupees? (e.g., 4500000 or 15000)");
      break;

    case "price":
      await ctx.runMutation(internal.telegram.updateState, { 
        chatId, step: "finish", data: { price: text } 
      });
      // In a real app, we'd add photo handling here. For MVP, let's wrap up.
      await sendMessage(chatId, `Summary of your listing:\n- ${data.transactionType} ${data.propertyType}\n- Price: ₹${text}\n\nConfirm to post?`, {
        reply_markup: {
          keyboard: [[{ text: "Confirm ✅" }, { text: "Cancel ❌" }]],
          one_time_keyboard: true, resize_keyboard: true
        }
      });
      break;

    case "finish":
      if (text === "Confirm ✅") {
        // Here we'd call properties:createProperty mutation
        await sendMessage(chatId, "🚀 Property posted successfully! You can view it on your dashboard.");
        await ctx.runMutation(internal.telegram.resetState, { chatId }); // Delete state
      } else {
        await sendMessage(chatId, "Listing cancelled.");
        await ctx.runMutation(internal.telegram.resetState, { chatId });
      }
      break;
  }
}

// External API Call Helper
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
