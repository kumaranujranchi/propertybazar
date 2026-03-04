import { internalMutation, mutation } from "./_generated/server";
import { v } from "convex/values";

export const generateShorttermSitemap = internalMutation({
  args: {},
  handler: async (ctx: any) => {
    try {
      // Fetch all properties and filter to visible short-term (<= 30 days, not rejected)
      const results = await ctx.db.query("properties").collect();
      const visible = results.filter((p: any) => {
        if (p.approvalStatus === "rejected") return false;
        const activationTime = p.lastActivatedAt || p._creationTime;
        const daysSince = (Date.now() - activationTime) / (1000 * 60 * 60 * 24);
        return daysSince <= 30;
      });

      // Build sitemap XML
      const domain = "https://24dismil.com";
      const entries = visible.map((p: any) => {
        const idStr = p._id && p._id.toString ? p._id.toString() : String(p._id);
        const loc = `${domain}/property-detail.html?id=${encodeURIComponent(idStr)}`;
        const lastmod = new Date(p.lastActivatedAt || p._creationTime).toISOString();
        return `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>daily</changefreq>\n    <priority>0.8</priority>\n  </url>`;
      }).join("\n");

      const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>`;

      // Store in Convex storage
      const encoder = new TextEncoder();
      const sid = await ctx.storage.store(encoder.encode(xml));
      const publicUrl = await ctx.storage.getUrl(sid as any);

      // Ping Google (best-effort)
      if (publicUrl) {
        const pingUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(publicUrl)}`;
        try {
          const res = await fetch(pingUrl);
          if (!res.ok) {
            console.error('Google ping failed', res.status, await res.text());
          }
        } catch (e) {
          console.error('Google ping error', e);
        }
      }

      return { storageId: sid, url: publicUrl || null, count: visible.length };
    } catch (e) {
      console.error('sitemap generation failed', e);
      throw e;
    }
  },
});

// Token-protected trigger to run the internal generator on-demand from the Convex dashboard or server.
export const triggerGenerateShorttermSitemap = mutation({
  args: { token: v.string() },
  handler: async (ctx: any, args: any) => {
    const secret = process.env.SITEMAP_TRIGGER_TOKEN || null;
    if (!secret || args.token !== secret) {
      throw new Error('Unauthorized');
    }
    // Run the internal generator and return its result
    try {
      const result = await ctx.runMutation((await import("./_generated/api")).internal.sitemaps.generateShorttermSitemap, {});
      return result;
    } catch (e) {
      console.error('trigger run failed', e);
      throw e;
    }
  }
});
