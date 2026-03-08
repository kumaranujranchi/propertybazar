import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run once a day at midnight UTC to delete properties older than 60 days
crons.daily(
  "delete-old-properties",
  { hourUTC: 0, minuteUTC: 0 },
  internal.properties.deleteOldProperties
);

crons.daily(
  "delete-old-drafts",
  { hourUTC: 0, minuteUTC: 0 },
  internal.drafts.deleteOldDrafts
);

// Generate and publish short-term sitemap daily (1:00 UTC)
crons.daily(
  "generate-shortterm-sitemap",
  { hourUTC: 1, minuteUTC: 0 },
  internal.sitemaps.generateShorttermSitemap
);

crons.daily(
  "ping-search-engines",
  { hourUTC: 2, minuteUTC: 0 },
  internal.sitemaps.pingSearchEngines
);

export default crons;
