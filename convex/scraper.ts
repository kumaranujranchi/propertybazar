import { mutation } from "./_generated/server";
import { v } from "convex/values";

export const generateUploadUrl = mutation({
  args: { apiKey: v.string() },
  handler: async (ctx, args) => {
    const expectedKey = process.env.SCRAPER_API_KEY;
    if (!expectedKey || args.apiKey !== expectedKey) {
      throw new Error("Unauthorized: Invalid API Key");
    }
    return await ctx.storage.generateUploadUrl();
  },
});

export const importProperty = mutation({
  args: {
    apiKey: v.string(),
    transactionType: v.string(),
    propertyType: v.string(),
    location: v.any(),
    details: v.any(),
    amenities: v.array(v.string()),
    photos: v.array(v.any()),
    pricing: v.any(),
    contactDesc: v.any(),
    posterType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const expectedKey = process.env.SCRAPER_API_KEY;
    if (!expectedKey || args.apiKey !== expectedKey) {
      throw new Error("Unauthorized: Invalid API Key");
    }

    const propertyId = await ctx.db.insert("properties", {
      transactionType: args.transactionType,
      propertyType: args.propertyType,
      location: args.location,
      details: args.details,
      amenities: args.amenities,
      photos: args.photos,
      pricing: args.pricing,
      contactDesc: args.contactDesc,
      posterType: args.posterType || "Bot",
      approvalStatus: "approved", // Scraped properties are visible immediately
      lastActivatedAt: Date.now(),
      activations: [Date.now()],
    });

    return { success: true, propertyId };
  },
});
