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

    // Count user's posted properties
    const myProperties = await ctx.db
      .query("properties")
      .filter((q) => q.eq(q.field("userId"), user._id))
      .collect();

    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      propertyCount: myProperties.length,
      freeLimit: FREE_PROPERTY_LIMIT,
      canPostMore: myProperties.length < FREE_PROPERTY_LIMIT,
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
