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
      metroDistance: v.optional(v.string()),
      schoolDistance: v.optional(v.string()),
      mallDistance: v.optional(v.string()),
      hospitalDistance: v.optional(v.string()),
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
      propertyTitle: v.optional(v.string()),
      ownershipType: v.optional(v.string()),
      bathrooms: v.optional(v.number()),
      balconies: v.optional(v.number()),
      studyRoom: v.optional(v.boolean()),
      servantRoom: v.optional(v.boolean()),
      poojaRoom: v.optional(v.boolean()),
      storeRoom: v.optional(v.boolean()),
      basement: v.optional(v.boolean()),
      floorConfig: v.optional(v.string()),
      plotArea: v.optional(v.number()),
      superBuiltUpArea: v.optional(v.number()),
      openArea: v.optional(v.number()),
      frontageWidth: v.optional(v.number()),
      roadWidth: v.optional(v.number()),
      ageOfProperty: v.optional(v.string()),
      constructionQuality: v.optional(v.string()),
      flooringType: v.optional(v.string()),
      wallFinish: v.optional(v.string()),
      ceilingHeight: v.optional(v.number()),
      waterSource: v.optional(v.string()),
      electricityLoad: v.optional(v.string()),
      openParking: v.optional(v.string()),
      garage: v.optional(v.boolean()),
      evCharging: v.optional(v.boolean()),
      approvalAuthority: v.optional(v.string()),
      occupancyCertificate: v.optional(v.boolean()),
      completionCertificate: v.optional(v.boolean()),
      propertyTaxStatus: v.optional(v.string()),
      loanApproved: v.optional(v.string()),

      // Commercial Property Specific
      commercialType: v.optional(v.string()),
      grade: v.optional(v.string()),
      frontage: v.optional(v.number()),
      workstations: v.optional(v.number()),
      cabins: v.optional(v.number()),
      meetingRooms: v.optional(v.number()),
      conferenceRoom: v.optional(v.boolean()),
      receptionArea: v.optional(v.boolean()),
      pantry: v.optional(v.boolean()),
      washrooms: v.optional(v.string()), // Private / Common
      serverRoom: v.optional(v.boolean()),
      acType: v.optional(v.string()), // Central AC / Split AC
      powerBackupCapacity: v.optional(v.string()),
      retailFloor: v.optional(v.string()), // Ground Floor / Upper Floor
      glassFrontage: v.optional(v.boolean()),
      displayArea: v.optional(v.boolean()),
      footfallZone: v.optional(v.string()), // High/Medium/Low
      mallHighStreet: v.optional(v.string()),
      escalator: v.optional(v.boolean()),
      loadingAccess: v.optional(v.boolean()),
      fireNoc: v.optional(v.boolean()),
      tradeLicense: v.optional(v.boolean()),
      commercialApproval: v.optional(v.boolean()),
      pollutionClearance: v.optional(v.boolean()),
    }),
    amenities: v.array(v.string()),
    photos: v.array(v.string()),
    pricing: v.object({
      expectedPrice: v.number(),
      priceType: v.optional(v.string()),
      maintenance: v.optional(v.number()),
      tokenAmount: v.optional(v.number()),
      negotiable: v.optional(v.boolean()),
      availabilityDate: v.optional(v.string()),

      // Commercial Pricing
      rent: v.optional(v.number()),
      leasePeriod: v.optional(v.string()),
      lockInPeriod: v.optional(v.string()),
      securityDeposit: v.optional(v.number()),
      camCharges: v.optional(v.number()),
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
    approvalStatus: v.optional(v.string()), // 'pending', 'approved', 'rejected'
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
