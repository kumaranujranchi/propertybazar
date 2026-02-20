import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const getProperties = query({
  args: {
    transactionType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let propertiesQuery = ctx.db.query("properties");
    if (args.transactionType) {
      propertiesQuery = propertiesQuery.filter((q) => 
        q.eq(q.field("transactionType"), args.transactionType)
      );
    }
    const properties = await propertiesQuery.order("desc").collect();

    // Resolve storageIds to actual URLs for each property
    return await Promise.all(
      properties.map(async (p) => {
        const resolvedPhotos = await Promise.all(
          (p.photos || []).map(async (storageId: string) => {
            try {
              const url = await ctx.storage.getUrl(storageId as any);
              return url ?? storageId;
            } catch {
              return storageId;
            }
          })
        );
        return { ...p, photos: resolvedPhotos };
      })
    );
  },
});

export const getProperty = query({
  args: { id: v.id("properties") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const createProperty = mutation({
  args: {
    token: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    transactionType: v.string(),
    propertyType: v.string(),
    location: v.object({
      state: v.string(),
      city: v.string(),
      locality: v.string(),
      society: v.optional(v.string()),
      fullAddress: v.optional(v.string()),
      pinCode: v.string(),
      landmark: v.optional(v.string()),
    }),
    details: v.object({
      bhk: v.string(),
      status: v.string(),
      builtUpArea: v.number(),
      carpetArea: v.optional(v.number()),
      floorNumber: v.optional(v.number()),
      totalFloors: v.optional(v.number()),
      furnishing: v.optional(v.string()),
      facing: v.optional(v.string()),
      parking: v.optional(v.string()),
      constructionYear: v.optional(v.number()),
      description: v.string(),
    }),
    amenities: v.array(v.string()),
    photos: v.array(v.string()),
    pricing: v.object({
      expectedPrice: v.number(),
      priceType: v.optional(v.string()),
      maintenance: v.optional(v.number()),
      tokenAmount: v.optional(v.number()),
    }),
    contactDesc: v.object({
      name: v.string(),
      mobile: v.string(),
      email: v.string(),
      role: v.optional(v.string()),
      rera: v.optional(v.string()),
      contactTime: v.optional(v.string()),
    })
  },
  handler: async (ctx, args) => {
    const FREE_LIMIT = 3;
    let resolvedUserId = args.userId;

    // Server-side session verification
    if (args.token) {
      const session = await ctx.db
        .query("sessions")
        .withIndex("by_token", (q) => q.eq("token", args.token as string))
        .first();
      if (session && session.expiresAt > Date.now()) {
        resolvedUserId = session.userId;
      }
    }

    // Enforce free posting limit
    if (resolvedUserId) {
      const existing = await ctx.db
        .query("properties")
        .filter((q) => q.eq(q.field("userId"), resolvedUserId))
        .collect();
      if (existing.length >= FREE_LIMIT) {
        throw new Error(`Free listing limit of ${FREE_LIMIT} reached. Please upgrade.`);
      }
    }

    const propertyId = await ctx.db.insert("properties", {
      userId: resolvedUserId,
      transactionType: args.transactionType,
      propertyType: args.propertyType,
      location: args.location,
      details: args.details,
      amenities: args.amenities,
      photos: args.photos,
      pricing: args.pricing,
      contactDesc: args.contactDesc,
    });
    return propertyId;
  },
});
