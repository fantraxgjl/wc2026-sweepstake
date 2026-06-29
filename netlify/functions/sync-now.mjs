import { getStore } from "@netlify/blobs";
import { runSync } from "../sync-core.mjs";

// On-demand sync triggered from the Admin tab. Gated by the admin PIN so the
// football-data.org quota can't be hammered by random visitors.
export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let pin = "";
  try { ({ pin = "" } = await req.json()); } catch {}

  const store = getStore({ name: "wc26", consistency: "strong" });
  const state = await store.get("state", { type: "json" });
  if (!state?.setupComplete) return Response.json({ ok: false, reason: "not-set-up" }, { status: 400 });
  if (!pin || pin !== state.pin) return Response.json({ ok: false, reason: "bad-pin" }, { status: 403 });

  const result = await runSync();
  return Response.json(result, { status: result.ok ? 200 : 502 });
};

export const config = { path: "/api/sync" };
