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
    overlayColor: v.optional(v.string()),
    overlayOpacity: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { city, type, storageId, bgPosition, title, subtitle, ctaLink, overlayColor, overlayOpacity } = args;
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
        overlayColor,
        overlayOpacity,
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
        overlayColor,
        overlayOpacity,
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

export const updateBanner = mutation({
  args: {
    bannerId: v.id("banners"),
    storageId: v.optional(v.id("_storage")),
    bgPosition: v.optional(v.union(v.string(), v.number())),
    title: v.optional(v.string()),
    subtitle: v.optional(v.string()),
    ctaLink: v.optional(v.string()),
    overlayColor: v.optional(v.string()),
    overlayOpacity: v.optional(v.number()),
    city: v.optional(v.string()),
    type: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { bannerId, storageId, city, type, bgPosition, title, subtitle, ctaLink, overlayColor, overlayOpacity } = args;
    const banner = await ctx.db.get(bannerId);
    if (!banner) return null;

    let finalStorageId = banner.storageId;
    if (storageId) {
      await ctx.storage.delete(banner.storageId);
      finalStorageId = storageId;
    }

    await ctx.db.patch(bannerId, {
      storageId: finalStorageId,
      city: city ?? banner.city,
      type: type ?? banner.type,
      bgPosition: bgPosition ?? banner.bgPosition,
      title: title ?? banner.title,
      subtitle: subtitle ?? banner.subtitle,
      ctaLink: ctaLink ?? banner.ctaLink,
      overlayColor: overlayColor ?? banner.overlayColor,
      overlayOpacity: overlayOpacity ?? banner.overlayOpacity,
      lastUpdated: Date.now(),
    });
    return bannerId;
  },
});
