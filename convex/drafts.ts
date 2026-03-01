import { mutation, query, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const saveDraft = mutation({
  args: {
    token: v.string(),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!session || session.expiresAt < Date.now()) {
      throw new Error("Unauthorized");
    }

    const existing = await ctx.db
      .query("drafts")
      .filter((q) => q.eq(q.field("userId"), session.userId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        data: args.data,
        lastUpdated: Date.now(),
      });
      return existing._id;
    } else {
      return await ctx.db.insert("drafts", {
        userId: session.userId,
        data: args.data,
        lastUpdated: Date.now(),
      });
    }
  },
});

export const getDraft = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    try {
      if (!args.token) return null;
      
      const session = await ctx.db
        .query("sessions")
        .withIndex("by_token", (q) => q.eq("token", args.token))
        .first();

      if (!session || session.expiresAt < Date.now()) {
        console.log("GetDraft: No valid session found");
        return null;
      }

      const draft = await ctx.db
        .query("drafts")
        .filter((q) => q.eq(q.field("userId"), session.userId))
        .first();
        
      return draft;
    } catch (err) {
      console.error("Draft query error:", err);
      return null;
    }
  },
});

export const deleteDraft = mutation({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    const session = await ctx.db
      .query("sessions")
      .withIndex("by_token", (q) => q.eq("token", args.token))
      .first();

    if (!session || session.expiresAt < Date.now()) throw new Error("Unauthorized");

    const draft = await ctx.db
      .query("drafts")
      .filter((q) => q.eq(q.field("userId"), session.userId))
      .first();

    if (draft) {
      await ctx.db.delete(draft._id);
    }
    return { success: true };
  },
});

export const deleteOldDrafts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const tenDaysAgo = Date.now() - 10 * 24 * 60 * 60 * 1000;

    const oldDrafts = await ctx.db
      .query("drafts")
      .withIndex("by_lastUpdated", (q) => q.lt("lastUpdated", tenDaysAgo))
      .collect();

    for (const draft of oldDrafts) {
      await ctx.db.delete(draft._id);
    }

    return { deletedCount: oldDrafts.length };
  },
});
