import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const getProperties = query({
  args: {
    transactionType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let propertiesQuery;
    if (args.transactionType) {
      propertiesQuery = ctx.db
        .query("properties")
        .withIndex("by_transactionType", (q) => q.eq("transactionType", args.transactionType as string));
    } else {
      propertiesQuery = ctx.db.query("properties");
    }
    const results = await propertiesQuery.order("desc").collect();
    
    // Sort so featured comes first, while keeping descending order for the rest
    const properties = results.sort((a, b) => {
      if (a.isFeatured && !b.isFeatured) return -1;
      if (!a.isFeatured && b.isFeatured) return 1;
      return 0; 
    });

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
    const p = await ctx.db.get(args.id);
    if (!p) return null;
    const resolvedPhotos = await Promise.all(
      (p.photos || []).map(async (sid: string) => {
        try { return (await ctx.storage.getUrl(sid as any)) ?? sid; } catch { return sid; }
      })
    );
    return { ...p, photos: resolvedPhotos };
  },
});

export const getPhotoUrl = query({
  args: { storageId: v.string() },
  handler: async (ctx, args) => {
    try { return await ctx.storage.getUrl(args.storageId as any); } catch { return null; }
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
    let resolvedUserId = args.userId;
    let isFeatured = false;

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

    // Enforce dynamic posting limit and check tier for featured status
    if (resolvedUserId) {
      const user = await ctx.db.get(resolvedUserId);
      if (user) {
        let activeTier = user.subscriptionTier || 'free';
        if (activeTier !== 'free' && user.subscriptionExpiry && user.subscriptionExpiry < Date.now()) {
          activeTier = 'free'; // Downgrade if expired
        }

        let limit = 3; // FREE_LIMIT
        if (activeTier === 'premium') limit = 10;
        if (activeTier === 'agent') limit = 50;

        // Premium and Agent listings are automatically featured
        if (activeTier === 'premium' || activeTier === 'agent') {
          isFeatured = true;
        }

        const existing = await ctx.db
          .query("properties")
          .filter((q) => q.eq(q.field("userId"), resolvedUserId))
          .collect();

        if (existing.length >= limit) {
          throw new Error(`Your ${activeTier} plan limit of ${limit} listings reached. Please upgrade.`);
        }
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
      isFeatured: isFeatured,
    });
    return propertyId;
  },
});

export const deleteOldProperties = internalMutation({
  args: {},
  handler: async (ctx) => {
    // 60 days ago in milliseconds
    const sixtyDaysAgo = Date.now() - 60 * 24 * 60 * 60 * 1000;
    
    // Find properties created before 60 days ago
    const oldProperties = await ctx.db
      .query("properties")
      .filter((q) => q.lt(q.field("_creationTime"), sixtyDaysAgo))
      .collect();

    for (const prop of oldProperties) {
      // 1. Delete associated photos from storage
      for (const storageId of prop.photos || []) {
        try {
          await ctx.storage.delete(storageId as any);
        } catch (e) {
          console.error("Failed to delete photo:", storageId, e);
        }
      }
      // 2. Delete the property record
      await ctx.db.delete(prop._id);
    }
    
    return { deletedCount: oldProperties.length };
  }
});

// =================== LEADS SYSTEM ===================

export const contactOwner = mutation({
  args: {
    propertyId: v.id("properties"),
    name: v.string(),
    email: v.string(),
    phone: v.string(),
    message: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    // 1. Find the property to get the ownerId
    const property = await ctx.db.get(args.propertyId);
    if (!property) throw new Error("Property not found");

    // 2. Insert lead
    await ctx.db.insert("leads", {
      propertyId: args.propertyId,
      ownerId: property.userId,
      inquirerName: args.name,
      inquirerEmail: args.email,
      inquirerPhone: args.phone,
      message: args.message
    });

    return { success: true };
  }
});

export const getMyLeads = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    if (!args.token) return [];
    
    // Auth check
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
      
    if (!session || session.expiresAt < Date.now()) return [];

    // Fetch leads for this user's properties
    const leads = await ctx.db
      .query("leads")
      .withIndex("by_ownerId", (q) => q.eq("ownerId", session.userId))
      .order("desc")
      .collect();

    // Attach property details
    const leadsWithPropertyInfo = await Promise.all(
      leads.map(async (lead) => {
        const prop = await ctx.db.get(lead.propertyId);
        return {
          ...lead,
          propertyTitle: prop ? `${prop.details.bhk !== 'N/A' && prop.details.bhk ? prop.details.bhk + ' BHK ' : ''}${prop.propertyType} in ${prop.location.locality}` : "Deleted Property",
          propertyType: prop?.propertyType || ''
        };
      })
    );

    return leadsWithPropertyInfo;
  }
});
