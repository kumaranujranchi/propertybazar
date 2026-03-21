import { action, mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Sends a WhatsApp OTP via Authkey.io
 */
export const sendOtp = action({
  args: {
    mobile: v.string(),
    countryCode: v.string(),
  },
  handler: async (ctx, args) => {
    const authkey = process.env.AUTHKEY_API_KEY;
    const sid = process.env.AUTHKEY_WHATSAPP_SID; // WhatsApp Sender ID (sid)

    if (!authkey || !sid) {
      console.error("Missing AUTHKEY_API_KEY or AUTHKEY_WHATSAPP_SID");
      return { success: false, message: "Server configuration error" };
    }

    // Generate a 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Construct the Authkey API URL as per documentation screenshot
    const url = new URL("https://api.authkey.io/request");
    url.searchParams.append("authkey", authkey);
    url.searchParams.append("mobile", args.mobile);
    url.searchParams.append("country_code", args.countryCode);
    url.searchParams.append("sid", sid);
    url.searchParams.append("otp", otp);

    try {
      const response = await fetch(url.toString(), { method: 'POST' });
      const resText = await response.text();
      
      // Authkey usually returns a numeric ID on success or a JSON string
      // We'll check if it looks like a success
      if (resText && !resText.toLowerCase().includes("error") && !resText.toLowerCase().includes("invalid")) {
        // Store the OTP in the database via a mutation
        await ctx.runMutation("authkey:storeOtp", {
          mobile: args.mobile,
          otp: otp,
        });
        return { success: true, message: "OTP sent successfully" };
      } else {
        console.error("Authkey API Response Error:", resText);
        return { success: false, message: "Failed to send OTP. Please check your number." };
      }
    } catch (error) {
      console.error("Authkey call failed:", error);
      return { success: false, message: "Communication error with WhatsApp service" };
    }
  },
});

/**
 * Stores the OTP for a mobile number (internal or used by action)
 */
export const storeOtp = mutation({
  args: {
    mobile: v.string(),
    otp: v.string(),
  },
  handler: async (ctx, args) => {
    // Cleanup any existing OTPs for this number
    const existing = await ctx.db
      .query("whatsapp_otps")
      .withIndex("by_mobile", (q) => q.eq("mobile", args.mobile))
      .collect();
    
    for (const doc of existing) {
      await ctx.db.delete(doc._id);
    }

    // Insert new OTP with 10-minute expiry
    await ctx.db.insert("whatsapp_otps", {
      mobile: args.mobile,
      otp: args.otp,
      expiresAt: Date.now() + 10 * 60 * 1000,
      verified: false,
    });
  },
});

/**
 * Verifies the OTP provided by the user
 */
export const verifyOtp = mutation({
  args: {
    mobile: v.string(),
    otp: v.string(),
  },
  handler: async (ctx, args) => {
    const record = await ctx.db
      .query("whatsapp_otps")
      .withIndex("by_mobile", (q) => q.eq("mobile", args.mobile))
      .order("desc")
      .first();

    if (!record) {
      return { success: false, message: "No OTP found. Please request a new one." };
    }

    if (record.expiresAt < Date.now()) {
      return { success: false, message: "OTP has expired. Please request a new one." };
    }

    if (record.otp !== args.otp) {
      return { success: false, message: "Incorrect OTP. Please try again." };
    }

    // Mark as verified
    await ctx.db.patch(record._id, { verified: true });
    return { success: true, message: "Verified successfully!" };
  },
});

/**
 * Checks if a mobile number is already verified in this session
 */
export const checkVerification = query({
  args: { mobile: v.string() },
  handler: async (ctx, args) => {
    if (!args.mobile) return false;
    
    const record = await ctx.db
      .query("whatsapp_otps")
      .withIndex("by_mobile", (q) => q.eq("mobile", args.mobile))
      .order("desc")
      .first();
    
    // Valid for 30 minutes after verification
    return record ? (record.verified && record.expiresAt + 20 * 60 * 1000 > Date.now()) : false;
  },
});
