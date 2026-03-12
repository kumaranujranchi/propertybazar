import { ConvexHttpClient } from "convex/browser";

const client = new ConvexHttpClient("https://veracious-caribou-870.convex.cloud");

const tests = [
  "hi",
  "Hi",
  "hello",
  "Gandhinagar",
  "Looking for 2bhk flat in Patna",
  "Gandhinagar mein 2bhk flat chahiye",
  "Patna mein 2bhk flat for rent",
  "I want a commercial shop in Delhi under 1 Cr",
];

async function run() {
  for (const t of tests) {
    try {
      console.log('\n---\nInput:', t);
      const res = await client.action("ai:parseSearchQuery", { query: t, history: [] });
      console.log('Result:', JSON.stringify(res, null, 2));
    } catch (e) {
      console.error('Error calling action for input', t, e);
    }
  }
}

run();
