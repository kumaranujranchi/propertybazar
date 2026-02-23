import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

// Mock constant for MVP. Later this can be in DB or ENV.
const ADMIN_EMAILS = ["admin@24dismil.com", "yashashreegroup1998@gmail.com"];

/**
 * Helper to check if the current user is an admin
 */
async function requireAdmin(ctx: any, token: string) {
  if (!token) throw new Error("Unauthenticated call to admin API");

  const session = await ctx.db
    .query("sessions")
    .withIndex("by_token", (q) => q.eq("token", token))
    .first();
    
  if (!session || session.expiresAt < Date.now()) {
    throw new Error("Invalid or expired session");
  }

  const user = await ctx.db.get(session.userId);
  if (!user || !user.email) {
    throw new Error("User not found or missing email");
  }
  
  if (!ADMIN_EMAILS.includes(user.email)) {
    throw new Error("Unauthorized: Not an admin. Your email: " + user.email);
  }
  
  return user;
}

export const getDashboardStats = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    // Requires Admin
    await requireAdmin(ctx, args.token);

    const properties = await ctx.db.query("properties").collect();
    const users = await ctx.db.query("users").collect();
    const leads = await ctx.db.query("leads").collect();

    const totalProps = properties.length;
    // Assume properties without approvalStatus are pending for now, or check explicit status
    const pendingProps = properties.filter(p => p.approvalStatus === "pending" || !p.approvalStatus).length;
    const activeProps = properties.length - pendingProps; 

    return {
      totalProperties: totalProps,
      pendingApprovals: pendingProps,
      activeListings: activeProps,
      totalUsers: users.length,
      totalLeads: leads.length
    };
  },
});

export const getAllProperties = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    
    // Fetch all properties, ordered by newest first (default internal ID ordering usually suffices, but can add timestamp)
    const properties = await ctx.db.query("properties").order("desc").collect();
    
    // We might want to join with User data if we have ownership relation
    return properties;
  },
});

export const getAllUsers = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    
    const users = await ctx.db.query("users").order("desc").collect();
    return users;
  },
});

export const updatePropertyStatus = mutation({
  args: { 
    token: v.string(),
    propertyId: v.id("properties"), 
    status: v.string() // "approved", "rejected", "pending"
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    
    await ctx.db.patch(args.propertyId, { 
      approvalStatus: args.status 
    });
    
    return { success: true };
  },
});


export const deleteProperty = mutation({
  args: { token: v.string(), propertyId: v.id("properties") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    await ctx.db.delete(args.propertyId);
    return { success: true };
  }
});
