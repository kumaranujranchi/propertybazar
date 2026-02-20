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
    const propertyId = await ctx.db.insert("properties", {
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
