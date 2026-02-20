import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Run once a day at midnight UTC to delete properties older than 60 days
crons.daily(
  "delete-old-properties",
  { hourUTC: 0, minuteUTC: 0 },
  internal.properties.deleteOldProperties
);

export default crons;
