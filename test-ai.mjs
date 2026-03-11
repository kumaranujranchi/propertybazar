import { ConvexHttpClient } from "convex/browser";

const client = new ConvexHttpClient("https://veracious-caribou-870.convex.cloud");

async function run() {
  try {
    console.log("Testing ai:rewriteDescription...");
    const res = await client.action("ai:rewriteDescription", { text: "2 bhk flat for rent in patna very nice" });
    console.log("Result:", res);
  } catch (e) {
    console.error("Error:", e);
  }
}
run();
