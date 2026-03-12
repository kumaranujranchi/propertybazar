import { ConvexHttpClient } from "convex/browser";

const client = new ConvexHttpClient("https://veracious-caribou-870.convex.cloud");

const cases = [
  { input: 'hi', expectCity: false },
  { input: 'hello', expectCity: false },
  { input: 'thanks', expectCity: false },
  { input: 'Gandhinagar', expectCity: true, expectedCity: 'Gandhinagar' },
  { input: 'Gandhinagar mein 2bhk flat chahiye', expectCity: true, expectedCity: 'Gandhinagar' },
  { input: 'Patna mein 2bhk flat for rent', expectCity: true, expectedCity: 'Patna' },
];

async function run() {
  let failed = 0;
  for (const c of cases) {
    try {
      console.log('Testing input:', c.input);
      const res = await client.action('ai:parseSearchQuery', { query: c.input, history: [] });
      const city = res?.filters?.city;
      const explanation = res?.filters?.explanation || '';
      console.log('  city:', city, 'explanation:', explanation.replace(/\n/g, ' ').slice(0, 120));
      if (c.expectCity) {
        if (!city || (c.expectedCity && city.toLowerCase() !== c.expectedCity.toLowerCase())) {
          console.error(`  ❌ Expected city ${c.expectedCity || 'present'} but got ${city}`);
          failed++;
        }
      } else {
        if (city) {
          console.error(`  ❌ Expected no city, but got ${city}`);
          failed++;
        }
      }
    } catch (e) {
      console.error('  Error:', e);
      failed++;
    }
  }

  if (failed > 0) {
    console.error(`\nTests failed: ${failed}`);
    process.exit(1);
  }
  console.log('\nAll tests passed');
  process.exit(0);
}

run();
