import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Helper to check if the current user is an admin
 * For MVP: any logged-in user with a valid session can access admin.
 * TODO: Add proper role-based access control later.
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
  if (!user) {
    throw new Error("User not found");
  }
  
  return user;
}

export const getDashboardStats = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    // Requires Admin
    const currentUser = await requireAdmin(ctx, args.token);

    const properties = await ctx.db.query("properties").collect();
    const users = await ctx.db.query("users").collect();
    const leads = await ctx.db.query("leads").collect();

    const totalProps = properties.length;
    const pendingProps = properties.filter(p => p.approvalStatus === "pending" || !p.approvalStatus).length;
    const activeProps = properties.length - pendingProps; 

    return {
      totalProperties: totalProps,
      pendingApprovals: pendingProps,
      activeListings: activeProps,
      totalUsers: users.length,
      totalLeads: leads.length,
      currentUser: { name: currentUser.name, email: currentUser.email },
    };
  },
});

export const getAllProperties = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    await requireAdmin(ctx, args.token);
    
    const properties = await ctx.db.query("properties").order("desc").collect();
    
    // Resolve storage IDs to actual URLs
    return await Promise.all(
      properties.map(async (p) => {
        const resolvedPhotos = await Promise.all(
          (p.photos || []).map(async (sid: string) => {
            try { return (await ctx.storage.getUrl(sid as any)) ?? null; } catch { return null; }
          })
        );
        return { ...p, photos: resolvedPhotos.filter(Boolean) };
      })
    );
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
