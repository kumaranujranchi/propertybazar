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

export const getSitemapXml = internalMutation({
  args: {},
  handler: async (ctx: any) => {
    const domain = "https://24dismil.com";
    const staticPages = [
      { loc: "", priority: "1.0", changefreq: "daily" },
      { loc: "/about.html", priority: "0.8", changefreq: "monthly" },
      { loc: "/contact.html", priority: "0.8", changefreq: "monthly" },
      { loc: "/properties.html", priority: "0.9", changefreq: "daily" },
      { loc: "/pricing.html", priority: "0.7", changefreq: "monthly" },
      { loc: "/login.html", priority: "0.5", changefreq: "monthly" },
      { loc: "/post-property.html", priority: "0.7", changefreq: "monthly" },
      { loc: "/privacy.html", priority: "0.3", changefreq: "monthly" },
      { loc: "/terms.html", priority: "0.3", changefreq: "monthly" },
    ];

    const properties = await ctx.db
      .query("properties")
      .filter((q: any) => q.eq(q.field("approvalStatus"), "approved"))
      .collect();

    const staticUrls = staticPages.map(page => `  <url>
    <loc>${domain}${page.loc}</loc>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join("\n");

    const dynamicUrls = properties.map((p: any) => {
      const idStr = p._id.toString();
      const loc = `${domain}/property-detail.html?id=${encodeURIComponent(idStr)}`;
      const lastmod = new Date(p.lastActivatedAt || p._creationTime).toISOString().split('T')[0];
      return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`;
    }).join("\n");

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls}
${dynamicUrls}
</urlset>`;
  }
});

export const pingSearchEngines = internalMutation({
  args: {},
  handler: async (ctx: any) => {
    const sitemapUrl = "https://24dismil.com/sitemap.xml";
    const googlePing = `https://www.google.com/ping?sitemap=${encodeURIComponent(sitemapUrl)}`;
    
    try {
      const response = await fetch(googlePing);
      if (response.ok) {
        console.log("Google pinged successfully");
      } else {
        console.error("Google ping failed", response.status);
      }
    } catch (error) {
      console.error("Error pinging Google", error);
    }
  }
});
