import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

const VALIDITY_PERIODS: Record<string, number> = {
  free: 30,
  premium: 30,
  agent: 30,
  agent_starter: 30,
  agent_pro: 30,
};

const GRACE_PERIOD_DAYS = 30;
const FREE_PROPERTY_LIMIT = 1;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

export const getProperties = query({
  args: {
    transactionType: v.optional(v.string()),
  },
  handler: async (ctx: any, args: any) => {
    let propertiesQuery;
    if (args.transactionType) {
      propertiesQuery = ctx.db
        .query("properties")
        .withIndex("by_transactionType", (q: any) => q.eq("transactionType", args.transactionType as string));
    } else {
      propertiesQuery = ctx.db.query("properties");
    }
    const results = await propertiesQuery.order("desc").collect();

    // Cache user tiers to avoid redundant fetching
    const userTierCache: Record<string, string> = {};

    // Only show properties that are APPROVED (active) or legacy (no status set)
    // and within their tier-aware validity window.
    const propertiesWithTiers = await Promise.all(results.map(async (p: any) => {
      if (!p.userId) return { ...p, tier: 'free' };
      if (!userTierCache[p.userId]) {
        const user = await ctx.db.get(p.userId);
        userTierCache[p.userId] = user?.subscriptionTier || 'free';
      }
      return { ...p, tier: userTierCache[p.userId] };
    }));

    const visibleResults = propertiesWithTiers.filter((p: any) => {
      const status = (p.approvalStatus || "").toLowerCase();

      // Always hide rejected
      if (status === "rejected") return false;

      // Pending: hide
      if (status === "pending") return false;

      // Tier-aware validity check
      const activationTime = p.lastActivatedAt || p._creationTime;
      const daysActive = (Date.now() - activationTime) / (1000 * 60 * 60 * 24);
      const allowedDays = VALIDITY_PERIODS[p.tier] || 30;

      if (daysActive > allowedDays) return false;

      return true;
    });

    // Sort so featured comes first, while keeping descending order for the rest
    const properties = visibleResults.sort((a: any, b: any) => {
      if (a.isFeatured && !b.isFeatured) return -1;
      if (!a.isFeatured && b.isFeatured) return 1;
      return 0;
    });

    // Resolve storageIds to actual URLs for each property
    return await Promise.all(
      properties.map(async (p: any) => {
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
  handler: async (ctx: any, args: any) => {
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
    // Resolve videos if present
    const resolvedVideos = await Promise.all(
      (p.videos || []).map(async (video: any) => {
        try {
          const storageId = typeof video === 'string' ? video : video.storageId;
          const url = await ctx.storage.getUrl(storageId as any);
          return typeof video === 'string' ? url : { ...video, url: url ?? null };
        } catch {
          return null;
        }
      })
    );

    // Resolve configuration photo URLs (if any)
    let resolvedConfigurations = p.configurations || [];
    if (Array.isArray(p.configurations)) {
      resolvedConfigurations = await Promise.all(
        p.configurations.map(async (cfg: any) => {
          if (!cfg || !Array.isArray(cfg.photos)) return cfg;
          const photos = await Promise.all(
            cfg.photos.map(async (ph: any) => {
              try {
                const sid = typeof ph === 'string' ? ph : ph.storageId;
                const url = await ctx.storage.getUrl(sid as any);
                return typeof ph === 'string' ? url : { ...ph, url: url ?? null };
              } catch { return null; }
            })
          );
          return { ...cfg, photos: photos.filter(Boolean) };
        })
      );
    }
    // Resolve brochure URL (if any)
    let resolvedBrochure = null;
    if (p.brochure) {
      try {
        const sid = typeof p.brochure === 'string' ? p.brochure : p.brochure.storageId;
        const url = await ctx.storage.getUrl(sid as any);
        resolvedBrochure = typeof p.brochure === 'string' ? url : { ...p.brochure, url: url ?? null };
      } catch { resolvedBrochure = null; }
    }

    const owner = p.userId ? await ctx.db.get(p.userId) : null;
    const ownerInfo = owner ? {
      name: owner.name,
      joinedYear: new Date(owner._creationTime).getFullYear(),
      profilePictureUrl: owner.profilePictureUrl,
      companyName: owner.companyName,
      officeAddress: owner.officeAddress,
      subscriptionTier: owner.subscriptionTier
    } : null;

    return { ...p, photos: resolvedPhotos.filter(Boolean), videos: resolvedVideos.filter(Boolean), configurations: resolvedConfigurations, brochure: resolvedBrochure, ownerInfo };
  },
});

export const getPhotoUrl = query({
  args: { storageId: v.any() },
  handler: async (ctx: any, args: any) => {
    try {
      const sid = typeof args.storageId === 'string' ? args.storageId : args.storageId?.storageId;
      if (!sid) return null;
      return await ctx.storage.getUrl(sid as any);
    } catch { return null; }
  },
});

const validateUserListingLimit = async (ctx: any, userId: string) => {
  const user = await ctx.db.get(userId);
  if (!user) return;

  const activePlans = (user.activePlans || []).filter((p: any) => p.expiresAt > Date.now());
  const paidLimit = activePlans.reduce((sum: number, p: any) => sum + p.listingsLimit, 0);
  const totalLimit = FREE_PROPERTY_LIMIT + paidLimit;

  const allMyProperties = await ctx.db
    .query("properties")
    .filter((q: any) => q.eq(q.field("userId"), userId))
    .collect();

  const nintyDaysAgo = Date.now() - NINETY_DAYS_MS;
  let totalActivationsLast90Days = 0;
  allMyProperties.forEach((p: any) => {
    const activations = p.activations || [p._creationTime];
    const validActivations = activations.filter((t: number) => t > nintyDaysAgo);
    totalActivationsLast90Days += validActivations.length;
  });

  if (totalActivationsLast90Days >= totalLimit) {
    throw new Error(`Your listing limit of ${totalLimit} has been reached. Please upgrade to post or repost more properties.`);
  }

  return { isFeatured: user.subscriptionTier === 'premium' || activePlans.some((p: any) => p.tier === 'premium') };
};

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
    configurations: v.optional(v.array(v.any())),
    externalVideos: v.optional(v.array(v.string())),
    pricing: v.any(),
    contactDesc: v.any(),
    posterType: v.optional(v.string()),
    customFAQs: v.optional(v.array(v.any())),
    brochure: v.optional(v.any()),
  },
  handler: async (ctx: any, args: any) => {
    let resolvedUserId = args.userId;
    let isFeatured = false;

    if (args.token) {
      const session = await ctx.db
        .query("sessions")
        .withIndex("by_token", (q: any) => q.eq("token", args.token as string))
        .first();
      if (session && session.expiresAt > Date.now()) {
        resolvedUserId = session.userId;
      }
    }

    if (resolvedUserId) {
      const result = await validateUserListingLimit(ctx, resolvedUserId);
      if (result) isFeatured = result.isFeatured;
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
      configurations: args.configurations,
      externalVideos: args.externalVideos,
      pricing: args.pricing,
      contactDesc: args.contactDesc,
      posterType: args.posterType || "Owner",
      customFAQs: args.customFAQs || [],
      brochure: args.brochure || null,
      isFeatured: isFeatured,
      approvalStatus: "pending",
      lastActivatedAt: Date.now(),
      activations: [Date.now()],
    });

    // Remove any lingering draft for this user (defensive server-side cleanup)
    try {
      if (resolvedUserId) {
        const existingDraft = await ctx.db
          .query("drafts")
          .filter((q: any) => q.eq(q.field("userId"), resolvedUserId))
          .first();
        if (existingDraft) {
          await ctx.db.delete(existingDraft._id);
        }
      }
    } catch (e) {
      console.error("Failed to cleanup draft after createProperty:", e);
    }
    return propertyId;
  },
});

export const deleteProperty = mutation({
  args: { token: v.string(), id: v.id("properties") },
  handler: async (ctx: any, args: any) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q: any) => q.eq("token", args.token))
      .first();
    if (!session || session.expiresAt < Date.now()) throw new Error("Unauthorized");

    const prop = await ctx.db.get(args.id);
    if (!prop) throw new Error("Property not found");
    if (prop.userId !== session.userId && prop.posterType !== "Bot") {
       throw new Error("Unauthorized: You do not own this property");
    }

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
    brochure: v.optional(v.any()),
    configurations: v.optional(v.array(v.any())),
    externalVideos: v.optional(v.array(v.string())),
    pricing: v.any(),
    contactDesc: v.any(),
    posterType: v.optional(v.string()),
    customFAQs: v.optional(v.array(v.any())),
  },
  handler: async (ctx: any, args: any) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q: any) => q.eq("token", args.token))
      .first();
    if (!session || session.expiresAt < Date.now()) throw new Error("Unauthorized");

    const prop = await ctx.db.get(args.id);
    if (!prop) throw new Error("Property not found");
    if (prop.userId !== session.userId && prop.posterType !== "Bot") {
       throw new Error("Unauthorized: You do not own this property");
    }

    await ctx.db.patch(args.id, {
      transactionType: args.transactionType,
      propertyType: args.propertyType,
      location: args.location,
      details: args.details,
      amenities: args.amenities,
      photos: args.photos,
      brochure: args.brochure,
      videos: args.videos,
      configurations: args.configurations,
      externalVideos: args.externalVideos,
      pricing: args.pricing,
      contactDesc: args.contactDesc,
      posterType: args.posterType,
      customFAQs: args.customFAQs,
    });

    // Defensive: remove any draft for this user after update as well
    try {
      const session = await ctx.db
        .query("sessions")
        .withIndex("by_token", (q: any) => q.eq("token", args.token))
        .first();
      const userIdToClean = session ? session.userId : null;
      if (userIdToClean) {
        const existingDraft = await ctx.db
          .query("drafts")
          .filter((q: any) => q.eq(q.field("userId"), userIdToClean))
          .first();
        if (existingDraft) await ctx.db.delete(existingDraft._id);
      }
    } catch (e) {
      console.error("Failed to cleanup draft after updateProperty:", e);
    }
    return { success: true };
  },
});

export const deleteOldProperties = internalMutation({
  args: {},
  handler: async (ctx: any) => {
    const properties = await ctx.db.query("properties").collect();
    const userTierCache: Record<string, string> = {};

    let deletedCount = 0;

    for (const prop of properties) {
      if (!prop.userId) continue;

      // Get tier
      if (!userTierCache[prop.userId]) {
        const user = await ctx.db.get(prop.userId);
        userTierCache[prop.userId] = user?.subscriptionTier || 'free';
      }
      const tier = userTierCache[prop.userId];

      const activeDays = VALIDITY_PERIODS[tier] || 30;
      const totalDaysUntilHardDelete = activeDays + GRACE_PERIOD_DAYS;

      const activationTime = prop.lastActivatedAt || prop._creationTime;
      const daysSinceActivation = (Date.now() - activationTime) / (1000 * 60 * 60 * 24);

      if (daysSinceActivation > totalDaysUntilHardDelete) {
        // 1. Delete associated photos from storage
        for (const photo of prop.photos || []) {
          try {
            const sid = typeof photo === 'string' ? photo : photo.storageId;
            if (sid) await ctx.storage.delete(sid as any);
          } catch (e) {
            console.error("Failed to delete photo:", photo, e);
          }
        }
        // 2. Delete the property record
        await ctx.db.delete(prop._id);
        deletedCount++;
      }
    }

    return { deletedCount };
  }
});

export const repostProperty = mutation({
  args: { token: v.string(), id: v.id("properties") },
  handler: async (ctx: any, args: any) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q: any) => q.eq("token", args.token))
      .first();
    if (!session || session.expiresAt < Date.now()) throw new Error("Unauthorized");

    const prop = await ctx.db.get(args.id);
    if (!prop) throw new Error("Property not found");
    if (prop.userId !== session.userId) throw new Error("Unauthorized: You do not own this property");

    await validateUserListingLimit(ctx, session.userId);

    const now = Date.now();
    const existingActivations = prop.activations || [prop.lastActivatedAt || prop._creationTime];

    await ctx.db.patch(args.id, {
      lastActivatedAt: now,
      activations: [...existingActivations, now],
      approvalStatus: "pending", // Reset to pending for re-validation if needed
    });

    return { success: true };
  },
});

export const reactivateProperty = mutation({
  args: { token: v.string(), id: v.id("properties") },
  handler: async (ctx: any, args: any) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q: any) => q.eq("token", args.token))
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
  handler: async (ctx: any, args: any) => {
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
  handler: async (ctx: any, args: any) => {
    if (!args.token) return [];

    // Auth check
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q: any) => q.eq("token", args.token))
      .first();

    if (!session || session.expiresAt < Date.now()) return [];

    // Fetch leads for this user's properties
    const leads = await ctx.db
      .query("leads")
      .withIndex("by_ownerId", (q: any) => q.eq("ownerId", session.userId))
      .order("desc")
      .collect();

    // Attach property details
    const leadsWithPropertyInfo = await Promise.all(
      leads.map(async (lead: any) => {
        const prop = await ctx.db.get(lead.propertyId);
        const pName = prop?.details?.projectName;
        const bhk = prop ? (prop.details.bhk !== 'N/A' && prop.details.bhk ? prop.details.bhk + ' BHK ' : '') : '';
        const baseTitle = prop ? `${bhk}${prop.propertyType} in ${prop.location.locality}` : "Deleted Property";
        
        return {
          ...lead,
          propertyTitle: pName ? `${pName.toUpperCase()} (${baseTitle})` : baseTitle,
          propertyType: prop?.propertyType || ''
        };
      })
    );

    return leadsWithPropertyInfo;
  }
});

export const updateLeadStatus = mutation({
  args: { token: v.string(), leadId: v.id("leads"), status: v.string() },
  handler: async (ctx: any, args: any) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q: any) => q.eq("token", args.token))
      .first();
    if (!session || session.expiresAt < Date.now()) throw new Error("Unauthorized");

    const lead = await ctx.db.get(args.leadId);
    if (!lead || lead.ownerId !== session.userId) throw new Error("Not found");

    const allowed = ["new", "contacted", "not_responding", "interested", "not_interested", "follow_up"];
    if (!allowed.includes(args.status)) throw new Error("Invalid status");

    await ctx.db.patch(args.leadId, { leadStatus: args.status });
    return { ok: true };
  },
});

export const getUniqueCities = query({
  args: {},
  handler: async (ctx: any) => {
    const properties = await ctx.db.query("properties").collect();
    const cities = new Set<string>();

    properties.forEach((p: any) => {
      if (p.location && p.location.city) {
        cities.add(p.location.city.trim());
      }
    });

    // Also include defaults
    const defaults = [
      'Ahmedabad', 'Bangalore', 'Gurgaon', 'Hyderabad', 'Mumbai', 'New Delhi', 'Noida', 'Pune',
      'Bhopal', 'Bhubaneswar', 'Chandigarh', 'Chennai', 'Coimbatore', 'Faridabad',
      'Gandhinagar', 'Ghaziabad', 'Goa', 'Greater Noida', 'Indore', 'Jaipur',
      'Kochi', 'Kolkata', 'Lucknow', 'Nagpur', 'Nashik', 'Navi Mumbai',
      'Palghar', 'Patna', 'Ranchi', 'Surat', 'Thane', 'Vadodara', 'Visakhapatnam'
    ];

    defaults.forEach(c => cities.add(c));

    return Array.from(cities).sort();
  },
});

export const getPropertyBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx: any, args: any) => {
    // Normalize incoming slug
    const slug = (args.slug || '').toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

    // Fetch a reasonable number of properties to search (small sites expected)
    const properties = await ctx.db.query('properties').order('desc').collect();

    // Try to match on an explicit stored slug, projectName, or derived slug from projectName/location
    const match = properties.find((p: any) => {
      const projectName = (p.details && p.details.projectName) ? String(p.details.projectName).toLowerCase() : '';
      const locationName = (p.location && (p.location.society || p.location.locality)) ? String(p.location.society || p.location.locality).toLowerCase() : '';
      const tryNames = [projectName, locationName].filter(Boolean);
      // if property has explicit slug field
      if (p.slug && String(p.slug).toLowerCase() === slug) return true;
      for (const name of tryNames) {
        const derived = name.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        if (derived === slug) return true;
      }
      return false;
    });

    if (!match) return null;

    // Reuse getProperty resolution logic: resolve photos, videos, configurations and owner info
    const p = match;
    const resolvedPhotos = await Promise.all(
      (p.photos || []).map(async (photo: any) => {
        try {
          const sid = typeof photo === 'string' ? photo : photo.storageId;
          const url = await ctx.storage.getUrl(sid as any);
          return typeof photo === 'string' ? url : { ...photo, url: url ?? null };
        } catch { return null; }
      })
    );

    const resolvedVideos = await Promise.all(
      (p.videos || []).map(async (video: any) => {
        try { const sid = typeof video === 'string' ? video : video.storageId; const url = await ctx.storage.getUrl(sid as any); return typeof video === 'string' ? url : { ...video, url: url ?? null }; } catch { return null; }
      })
    );

    let resolvedConfigurations = p.configurations || [];
    if (Array.isArray(p.configurations)) {
      resolvedConfigurations = await Promise.all(
        p.configurations.map(async (cfg: any) => {
          if (!cfg || !Array.isArray(cfg.photos)) return cfg;
          const photos = await Promise.all(cfg.photos.map(async (ph: any) => {
            try { const sid = typeof ph === 'string' ? ph : ph.storageId; const url = await ctx.storage.getUrl(sid as any); return typeof ph === 'string' ? url : { ...ph, url: url ?? null }; } catch { return null; }
          }));
          return { ...cfg, photos: photos.filter(Boolean) };
        })
      );
    }

    let resolvedBrochure = null;
    if (p.brochure) {
      try { const sid = typeof p.brochure === 'string' ? p.brochure : p.brochure.storageId; const url = await ctx.storage.getUrl(sid as any); resolvedBrochure = typeof p.brochure === 'string' ? url : { ...p.brochure, url: url ?? null }; } catch { resolvedBrochure = null; }
    }

    const owner = p.userId ? await ctx.db.get(p.userId) : null;
    const ownerInfo = owner ? {
      name: owner.name,
      joinedYear: new Date(owner._creationTime).getFullYear(),
      profilePictureUrl: owner.profilePictureUrl,
      companyName: owner.companyName,
      officeAddress: owner.officeAddress,
      subscriptionTier: owner.subscriptionTier
    } : null;

    return { ...p, photos: resolvedPhotos.filter(Boolean), videos: resolvedVideos.filter(Boolean), configurations: resolvedConfigurations, brochure: resolvedBrochure, ownerInfo };
  }
});

export const getForOg = query({
  args: { id: v.optional(v.string()), slug: v.optional(v.string()) },
  handler: async (ctx: any, args: any) => {
    let p = null;
    
    if (args.slug) {
      const slug = args.slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      const properties = await ctx.db.query('properties').order('desc').collect();
      p = properties.find((pr: any) => {
        if (pr.slug && String(pr.slug).toLowerCase() === slug) return true;
        const projectName = (pr.details && pr.details.projectName) ? String(pr.details.projectName).toLowerCase() : '';
        const locationName = (pr.location && (pr.location.society || pr.location.locality)) ? String(pr.location.society || pr.location.locality).toLowerCase() : '';
        for (const name of [projectName, locationName].filter(Boolean)) {
          if (name.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') === slug) return true;
        }
        return false;
      });
    } else if (args.id) {
      try { p = await ctx.db.get(args.id as any); } catch { /* ignore invalid id */ }
    }

    if (!p) return null;

    let imageUrl = "https://24dismil.com/images/hero-bg.jpg";
    if (Array.isArray(p.photos) && p.photos.length > 0) {
      const firstPhoto = p.photos[0];
      try {
        const sid = typeof firstPhoto === 'string' ? firstPhoto : firstPhoto.storageId;
        const url = await ctx.storage.getUrl(sid as any);
        if (url) imageUrl = url;
      } catch { }
    }

    const titleParts = [];
    if (p.details?.bhk && p.details.bhk !== 'N/A') titleParts.push(`${p.details.bhk} BHK`);
    if (p.propertyType) titleParts.push(p.propertyType);
    if (p.location?.locality) titleParts.push(`in ${p.location.locality}`);
    
    const fallbackTitle = titleParts.join(' ');
    
    return {
      title: p.details?.projectName ? `${p.details.projectName} - ${fallbackTitle}` : fallbackTitle,
      description: p.details?.description ? p.details.description.substring(0, 160) : `Check out this ${fallbackTitle}`,
      image: imageUrl
    };
  }
});

export const getHandpickedProperties = query({
  args: {},
  handler: async (ctx: any) => {
    const props = await ctx.db
      .query('properties')
      .withIndex('by_handpicked', (q: any) => q.eq('isHandpicked', true))
      .order('desc')
      .collect();

    return await Promise.all(
      props.filter((p: any) => (p.approvalStatus || '').toLowerCase() === 'approved').map(async (p: any) => {
        let firstPhotoUrl: string | null = null;
        if (Array.isArray(p.photos) && p.photos.length > 0) {
          const firstPhoto = p.photos[0];
          try {
            const sid = typeof firstPhoto === 'string' ? firstPhoto : firstPhoto.storageId;
            firstPhotoUrl = await ctx.storage.getUrl(sid as any);
          } catch { /* no photo */ }
        }
        return { ...p, firstPhotoUrl };
      })
    );
  },
});

export const getScrapedProperties = query({
  args: { token: v.string() },
  handler: async (ctx: any, args: any) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q: any) => q.eq("token", args.token))
      .first();
    if (!session || session.expiresAt < Date.now()) throw new Error("Unauthorized");

    const allProps = await ctx.db.query("properties").order("desc").collect();
    const scrapedProps = allProps.filter((p: any) => p.posterType === "Bot");

    return await Promise.all(
      scrapedProps.map(async (p: any) => {
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
  }
});
