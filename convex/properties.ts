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

    // Only show properties that are NOT rejected (disabled) and NOT EXPIRED (30 days)
    // Properties with no approvalStatus are visible by default (older listings)
    const visibleResults = results.filter(p => {
      if (p.approvalStatus === "rejected") return false;
      
      const activationTime = p.lastActivatedAt || p._creationTime;
      const daysSinceActivation = (Date.now() - activationTime) / (1000 * 60 * 60 * 24);
      if (daysSinceActivation > 30) return false;
      
      return true;
    });

    // Sort so featured comes first, while keeping descending order for the rest
    const properties = visibleResults.sort((a, b) => {
      if (a.isFeatured && !b.isFeatured) return -1;
      if (!a.isFeatured && b.isFeatured) return 1;
      return 0;
    });

    // Resolve storageIds to actual URLs for each property
    return await Promise.all(
      properties.map(async (p) => {
        const resolvedPhotos = await Promise.all(
          (p.photos || []).map(async (photo: any) => {
            try {
              const storageId = typeof photo === 'string' ? photo : photo.storageId;
              const url = await ctx.storage.getUrl(storageId as any);
              return typeof photo === 'string' ? url : { ...photo, url: url ?? null };
            } catch {
              return null;
            }
          })
        );
        return { ...p, photos: resolvedPhotos.filter(Boolean) };
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
      (p.photos || []).map(async (photo: any) => {
        try {
          const storageId = typeof photo === 'string' ? photo : photo.storageId;
          const url = await ctx.storage.getUrl(storageId as any);
          return typeof photo === 'string' ? url : { ...photo, url: url ?? null };
        } catch {
          return null;
        }
      })
    );
    const owner = p.userId ? await ctx.db.get(p.userId) : null;
    const ownerInfo = owner ? {
      name: owner.name,
      joinedYear: new Date(owner._creationTime).getFullYear(),
      profilePictureUrl: owner.profilePictureUrl
    } : null;

    return { ...p, photos: resolvedPhotos.filter(Boolean), ownerInfo };
  },
});

export const getPhotoUrl = query({
  args: { storageId: v.any() },
  handler: async (ctx, args) => {
    try {
      const sid = typeof args.storageId === 'string' ? args.storageId : args.storageId?.storageId;
      if (!sid) return null;
      return await ctx.storage.getUrl(sid as any);
    } catch { return null; }
  },
});

export const createProperty = mutation({
  args: {
    token: v.optional(v.string()),
    userId: v.optional(v.id("users")),
    transactionType: v.string(),
    propertyType: v.string(),
    location: v.any(),
    details: v.any(),
    amenities: v.array(v.string()),
    photos: v.array(v.any()),
    videos: v.optional(v.array(v.any())),
    externalVideos: v.optional(v.array(v.string())),
    pricing: v.any(),
    contactDesc: v.any()
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
        if (activeTier === 'agent_starter') limit = 15;
        if (activeTier === 'agent_pro' || activeTier === 'agent') limit = 50;

        // Premium and Agent listings are automatically featured
        if (activeTier === 'premium' || activeTier === 'agent_starter' || activeTier === 'agent_pro' || activeTier === 'agent') {
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
      videos: args.videos,
      externalVideos: args.externalVideos,
      pricing: args.pricing,
      contactDesc: args.contactDesc,
      isFeatured: isFeatured,
      approvalStatus: "pending",
      lastActivatedAt: Date.now(),
    });
    return propertyId;
  },
});

export const deleteProperty = mutation({
  args: { token: v.string(), id: v.id("properties") },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (!session || session.expiresAt < Date.now()) throw new Error("Unauthorized");

    const prop = await ctx.db.get(args.id);
    if (!prop) throw new Error("Property not found");
    if (prop.userId !== session.userId) throw new Error("Unauthorized: You do not own this property");

    // Delete photos from storage
    for (const storageId of prop.photos || []) {
      try { await ctx.storage.delete(storageId as any); } catch (e) { console.error(e); }
    }

    await ctx.db.delete(args.id);
    return { success: true };
  },
});

export const updateProperty = mutation({
  args: {
    token: v.string(),
    id: v.id("properties"),
    transactionType: v.string(),
    propertyType: v.string(),
    location: v.any(),
    details: v.any(),
    amenities: v.array(v.string()),
    photos: v.array(v.any()),
    videos: v.optional(v.array(v.any())),
    externalVideos: v.optional(v.array(v.string())),
    pricing: v.any(),
    contactDesc: v.any(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (!session || session.expiresAt < Date.now()) throw new Error("Unauthorized");

    const prop = await ctx.db.get(args.id);
    if (!prop) throw new Error("Property not found");
    if (prop.userId !== session.userId) throw new Error("Unauthorized: You do not own this property");

    await ctx.db.patch(args.id, {
      transactionType: args.transactionType,
      propertyType: args.propertyType,
      location: args.location,
      details: args.details,
      amenities: args.amenities,
      photos: args.photos,
      videos: args.videos,
      externalVideos: args.externalVideos,
      pricing: args.pricing,
      contactDesc: args.contactDesc,
    });
    return { success: true };
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

export const reactivateProperty = mutation({
  args: { token: v.string(), id: v.id("properties") },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (!session || session.expiresAt < Date.now()) throw new Error("Unauthorized");

    const prop = await ctx.db.get(args.id);
    if (!prop) throw new Error("Property not found");
    if (prop.userId !== session.userId) throw new Error("Unauthorized: You do not own this property");

    await ctx.db.patch(args.id, {
      lastActivatedAt: Date.now(),
    });
    
    return { success: true };
  },
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
