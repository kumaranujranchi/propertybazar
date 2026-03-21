import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

http.route({
  path: "/scraper/uploadUrl",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const data = await request.json();
      const url = await ctx.runMutation(api.scraper.generateUploadUrl, { apiKey: data.apiKey });
      return new Response(JSON.stringify({ url }), { status: 200, headers: { "Content-Type": "application/json" } });
    } catch(e: any) { return new Response(JSON.stringify({ error: e.message }), { status: 400 }) }
  })
});

http.route({
  path: "/scraper/import",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const data = await request.json();
      const res = await ctx.runMutation(api.scraper.importProperty, data);
      return new Response(JSON.stringify(res), { status: 200, headers: { "Content-Type": "application/json" } });
    } catch(e: any) { return new Response(JSON.stringify({ error: e.message }), { status: 400 }) }
  })
});
http.route({
  path: "/telegram",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const update = await request.json();
    
    // Call our handleUpdate action to process the bot logic
    await ctx.runAction(api.telegram.handleUpdate, { update });
    
    return new Response(null, { status: 200 });
  }),
});

http.route({
  path: "/sitemap.xml",
  method: "GET",
  handler: httpAction(async (ctx) => {
    const xml = await ctx.runMutation(api.sitemaps.getSitemapXml);
    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "application/xml",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }),
});

http.route({
  path: "/og",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    // Expected URL format: /og?id=... or /og?slug=...
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    const slug = url.searchParams.get("slug");

    if (!id && !slug) {
      return new Response(JSON.stringify({ error: "Missing id or slug" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const ogData = await ctx.runQuery(api.properties.getForOg, {
      id: id || undefined,
      slug: slug || undefined,
    });

    if (!ogData) {
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify(ogData), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600"
      }
    });
  }),
});

export default http;
