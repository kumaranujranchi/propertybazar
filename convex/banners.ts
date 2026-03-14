import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const listBanners = query({
  args: {},
  handler: async (ctx) => {
    const banners = await ctx.db.query("banners").collect();
    return Promise.all(
      banners.map(async (banner) => ({
        ...banner,
        url: await ctx.storage.getUrl(banner.storageId),
      }))
    );
  },
});

export const getBanner = query({
  args: { city: v.string(), type: v.string() },
  handler: async (ctx, args) => {
    const banner = await ctx.db
      .query("banners")
      .withIndex("by_city_type", (q) =>
        q.eq("city", args.city).eq("type", args.type)
      )
      .unique();

    if (!banner) return null;

    return {
      ...banner,
      url: await ctx.storage.getUrl(banner.storageId),
    };
  },
});

export const saveBanner = mutation({
  args: {
    city: v.string(),
    type: v.string(),
    storageId: v.id("_storage"),
    bgPosition: v.optional(v.union(v.string(), v.number())), // 0-100: % of image height from top where crop starts
    title: v.optional(v.string()),
    subtitle: v.optional(v.string()),
    ctaLink: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { city, type, storageId, bgPosition, title, subtitle, ctaLink } = args;
    // Check if a banner already exists for this city and type
    const existing = await ctx.db
      .query("banners")
      .withIndex("by_city_type", (q) =>
        q.eq("city", args.city).eq("type", args.type)
      )
      .unique();

    if (existing) {
      // Delete old photo from storage
      await ctx.storage.delete(existing.storageId);
      // Update existing record
      await ctx.db.patch(existing._id, {
        storageId,
        bgPosition,
        title,
        subtitle,
        ctaLink,
        lastUpdated: Date.now(),
      });
      return existing._id;
    } else {
      // Create new record
      return await ctx.db.insert("banners", {
        city,
        type,
        storageId,
        bgPosition,
        title,
        subtitle,
        ctaLink,
        lastUpdated: Date.now(),
      });
    }
  },
});

export const deleteBanner = mutation({
  args: { bannerId: v.id("banners") },
  handler: async (ctx, args) => {
    const banner = await ctx.db.get(args.bannerId);
    if (banner) {
      await ctx.storage.delete(banner.storageId);
      await ctx.db.delete(args.bannerId);
    }
  },
});
