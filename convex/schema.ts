import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  properties: defineTable({
    userId: v.optional(v.id("users")),
    transactionType: v.string(),
    propertyType: v.string(),
    location: v.any(),
    details: v.any(),
    amenities: v.array(v.string()),
    photos: v.array(v.any()), // Supports objects: { storageId, category, isCover }
    videos: v.optional(v.array(v.any())), // Supports objects: { storageId, category }
    externalVideos: v.optional(v.array(v.string())), // Youtube/Vimeo links
    pricing: v.any(),
    contactDesc: v.any(),
    isFeatured: v.optional(v.boolean()),
    approvalStatus: v.optional(v.string()), // 'pending', 'approved', 'rejected'
    lastActivatedAt: v.optional(v.number()),
  }).index("by_transactionType", ["transactionType"])
    .index("by_city", ["location.city"])
    .index("by_featured", ["isFeatured"])
    .index("by_approvalStatus", ["approvalStatus"]),

  users: defineTable({
    name: v.string(),
    email: v.string(),
    passwordHash: v.optional(v.string()),
    subscriptionTier: v.optional(v.string()), // 'free', 'premium', 'agent'
    subscriptionExpiry: v.optional(v.number()),
    // Profile
    mobile: v.optional(v.string()),
    companyName: v.optional(v.string()),
    officeAddress: v.optional(v.string()),
    profilePictureUrl: v.optional(v.string()),
    // RERA
    reraNumber: v.optional(v.string()),
    reraCertificateUrl: v.optional(v.string()),
    reraStatus: v.optional(v.string()), // pending, verified, rejected
    // Settings
    settings: v.optional(v.object({
      emailNotifications: v.boolean(),
      smsNotifications: v.boolean(),
    })),
    isAdmin: v.optional(v.boolean()),
  }).index("by_email", ["email"]),

  sessions: defineTable({
    userId: v.id("users"),
    token: v.string(),
    expiresAt: v.number(),
  }).index("by_token", ["token"]),

  leads: defineTable({
    propertyId: v.id("properties"),
    ownerId: v.optional(v.id("users")), // The user who listed the property
    inquirerName: v.string(),
    inquirerEmail: v.string(),
    inquirerPhone: v.string(),
    message: v.optional(v.string())
  }).index("by_ownerId", ["ownerId"]),
});
