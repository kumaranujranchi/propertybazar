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

      // Warehouse/Industrial Specific Location
      highwayDistance: v.optional(v.string()),
      railwayYardDistance: v.optional(v.string()),
      airportDistance: v.optional(v.string()),
      portDistance: v.optional(v.string()),
    }),
    details: v.object({
      bhk: v.optional(v.string()),
      status: v.optional(v.string()),
      builtUpArea: v.optional(v.number()),
      carpetArea: v.optional(v.number()),
      floorNumber: v.optional(v.number()),
      totalFloors: v.optional(v.number()),
      furnishing: v.optional(v.string()),
      facing: v.optional(v.string()),
      parking: v.optional(v.string()),
      constructionYear: v.optional(v.number()),
      description: v.optional(v.string()),
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

      // Warehouse / Industrial Specific Structure
      warehouseType: v.optional(v.string()),
      industrialZone: v.optional(v.string()),
      totalLandArea: v.optional(v.number()),
      coveredArea: v.optional(v.number()),
      openYardArea: v.optional(v.number()),
      clearHeight: v.optional(v.number()),
      sideHeight: v.optional(v.number()),
      industrialFlooringType: v.optional(v.string()),
      floorLoadCapacity: v.optional(v.string()),
      dockDoors: v.optional(v.number()),
      rampAvailability: v.optional(v.boolean()),
      truckTurningRadius: v.optional(v.string()),
      truckParking: v.optional(v.number()),
      carParking: v.optional(v.number()),

      // Warehouse Utilities & Safety
      powerLoadKva: v.optional(v.number()),
      transformer: v.optional(v.boolean()),
      borewell: v.optional(v.boolean()),
      drainage: v.optional(v.boolean()),
      sewage: v.optional(v.boolean()),
      internetFiber: v.optional(v.boolean()),
      fireHydrant: v.optional(v.boolean()),
      sprinklerSystem: v.optional(v.boolean()),
      pollutionNoc: v.optional(v.boolean()),
      factoryLicense: v.optional(v.boolean()),
      industrialApproval: v.optional(v.boolean()),

      // Hospitality / Hotel Specific
      hospitalityType: v.optional(v.string()), // Hotel, Resort, Guest House, Lodge, Service Apartment
      starRating: v.optional(v.number()),
      operationalStatus: v.optional(v.boolean()),
      totalRooms: v.optional(v.number()),
      roomTypes: v.optional(v.string()),
      occupancyRate: v.optional(v.number()),
      averageDailyRate: v.optional(v.number()),
      banquetHall: v.optional(v.boolean()),
      restaurant: v.optional(v.boolean()),
      barLicenseDetails: v.optional(v.boolean()),
      hospitalityPool: v.optional(v.boolean()),
      spa: v.optional(v.boolean()),
      gym: v.optional(v.boolean()),
      hospitalityLandArea: v.optional(v.number()),
      hospitalityBuiltUpArea: v.optional(v.number()),
      hospitalityParkingCapacity: v.optional(v.number()),
      kitchenSetup: v.optional(v.boolean()),
      laundrySetup: v.optional(v.boolean()),
      annualRevenue: v.optional(v.number()),
      monthlyRevenue: v.optional(v.number()),
      ebitda: v.optional(v.number()),
      staffStrength: v.optional(v.number()),
      hotelLicense: v.optional(v.boolean()),
      fssaiLicense: v.optional(v.boolean()),
      tourismRegistration: v.optional(v.boolean()),
    }),
    amenities: v.array(v.string()),
    photos: v.array(v.any()), // Supports objects: { storageId, category, isCover }
    videos: v.optional(v.array(v.any())), // Supports objects: { storageId, category }
    externalVideos: v.optional(v.array(v.string())), // Youtube/Vimeo links
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

      // Additional Pricing for Warehouse
      rentPerSqFt: v.optional(v.number()),
      escalationPercent: v.optional(v.number()),
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
