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

    const patch: any = {};
    if (city) patch.city = city;
    if (type) patch.type = type;
    if (typeof bgPosition !== 'undefined') patch.bgPosition = bgPosition;
    if (typeof title !== 'undefined') patch.title = title;
    if (typeof subtitle !== 'undefined') patch.subtitle = subtitle;
    if (typeof ctaLink !== 'undefined') patch.ctaLink = ctaLink;
    if (typeof overlayColor !== 'undefined') patch.overlayColor = overlayColor;
    if (typeof overlayOpacity !== 'undefined') patch.overlayOpacity = overlayOpacity;

    if (storageId) {
      // new image provided — delete old storage and set new one
      try {
        await ctx.storage.delete(banner.storageId);
      } catch (e) {
        // ignore storage delete errors
      }
      patch.storageId = storageId;
    }

    patch.lastUpdated = Date.now();

    await ctx.db.patch(bannerId, patch);
    return bannerId;
  },
});
