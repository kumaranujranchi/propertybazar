import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const FREE_PROPERTY_LIMIT = 3; // free listings per user
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// Simple hash for demo (NOTE: in production use bcrypt via an Action)
function simpleHash(str: string): string {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function generateToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let token = '';
  for (let i = 0; i < 48; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

// =================== REGISTER ===================
export const register = mutation({
  args: {
    name: v.string(),
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();

    if (existing) {
      throw new Error("Email already registered. Please login.");
    }

    const userId = await ctx.db.insert("users", {
      name: args.name,
      email: args.email.toLowerCase(),
      passwordHash: simpleHash(args.password),
    });

    const token = generateToken();
    await ctx.db.insert("sessions", {
      userId,
      token,
      expiresAt: Date.now() + SESSION_DURATION_MS,
    });

    return { token, name: args.name, email: args.email.toLowerCase() };
  },
});

// =================== LOGIN ===================
export const login = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();

    if (!user || user.passwordHash !== simpleHash(args.password)) {
      throw new Error("Invalid email or password.");
    }

    const token = generateToken();
    await ctx.db.insert("sessions", {
      userId: user._id,
      token,
      expiresAt: Date.now() + SESSION_DURATION_MS,
    });

    return { token, name: user.name, email: user.email };
  },
});

// =================== LOGOUT ===================
export const logout = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();
    if (session) await ctx.db.delete(session._id);
  },
});

// =================== GOOGLE LOGIN ===================
export const googleLogin = mutation({
  args: {
    uid: v.string(),
    email: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    let user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .first();

    if (!user) {
      const userId = await ctx.db.insert("users", {
        name: args.name,
        email: args.email.toLowerCase(),
        passwordHash: simpleHash(args.uid), // placeholder hash for oauth
      });
      user = await ctx.db.get(userId);
    }

    const token = generateToken();
    await ctx.db.insert("sessions", {
      userId: user!._id,
      token,
      expiresAt: Date.now() + SESSION_DURATION_MS,
    });

    return { token, name: user!.name, email: user!.email };
  },
});

// =================== GET ME ===================
export const getMe = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    if (!args.token) return null;

    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!session) return null;
    if (session.expiresAt < Date.now()) return null;

    const user = await ctx.db.get(session.userId);
    if (!user) return null;

    // Handle subscription expiry
    let activeTier = user.subscriptionTier || 'free';
    if (activeTier !== 'free' && user.subscriptionExpiry && user.subscriptionExpiry < Date.now()) {
      activeTier = 'free'; // Downgrade if expired
      // Optionally could update DB here, but read-time downgrade is fine
    }

    // Set dynamic limits
    let limit = FREE_PROPERTY_LIMIT;
    if (activeTier === 'premium') limit = 10;
    if (activeTier === 'agent_starter') limit = 15;
    if (activeTier === 'agent_pro' || activeTier === 'agent') limit = 50;

    // Count user's posted properties
    const myProperties = await ctx.db
      .query("properties")
      .filter((q) => q.eq(q.field("userId"), user._id))
      .collect();

    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      subscriptionTier: activeTier,
      subscriptionExpiry: user.subscriptionExpiry,
      propertyCount: myProperties.length,
      limit: limit,
      canPostMore: myProperties.length < limit,
    };
  },
});

// =================== MY PROPERTIES ===================
export const getMyProperties = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    if (!args.token) return [];

    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!session || session.expiresAt < Date.now()) return [];

    const properties = await ctx.db
      .query("properties")
      .filter((q) => q.eq(q.field("userId"), session.userId))
      .order("desc")
      .collect();

    return await Promise.all(
      properties.map(async (p) => {
        const resolvedPhotos = await Promise.all(
          (p.photos || []).map(async (storageId: string) => {
            try {
              return (await ctx.storage.getUrl(storageId as any)) ?? storageId;
            } catch { return storageId; }
          })
        );
        return { ...p, photos: resolvedPhotos };
      })
    );
  },
});
// =================== UPGRADE TIER ===================
export const upgradeTier = mutation({
  args: {
    token: v.string(),
    tier: v.string(), // 'premium', 'agent'
    durationDays: v.number(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!session || session.expiresAt < Date.now()) {
      throw new Error("Unauthorized");
    }

    const expiry = Date.now() + args.durationDays * 24 * 60 * 60 * 1000;

    await ctx.db.patch(session.userId, {
      subscriptionTier: args.tier,
      subscriptionExpiry: expiry,
    });

    return { success: true, tier: args.tier, expiresAt: expiry };
  }
});
