import { runSync } from "../sync-core.mjs";

// Scheduled job: pull results from football-data.org every 30 minutes.
export default async () => { await runSync(); };

export const config = { schedule: "*/30 * * * *" };
