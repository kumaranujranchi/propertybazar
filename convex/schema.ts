import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  properties: defineTable({
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
    }),
    isFeatured: v.optional(v.boolean()),
  }).index("by_transactionType", ["transactionType"])
    .index("by_city", ["location.city"])
    .index("by_featured", ["isFeatured"]),

  users: defineTable({
    name: v.string(),
    email: v.string(),
    passwordHash: v.string(),
    subscriptionTier: v.optional(v.string()), // 'free', 'premium', 'agent'
    subscriptionExpiry: v.optional(v.number()),
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
