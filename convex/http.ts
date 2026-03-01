import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";

const http = httpRouter();

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

export default http;
