import { getStore } from "@netlify/blobs";
import { pinOk } from "../auth.mjs";

// Server-side admin PIN check. The PIN is never sent to the client, so unlocking
// the Admin tab has to round-trip through here.
export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  let pin = "";
  try { ({ pin = "" } = await req.json()); } catch {}
  const store = getStore({ name: "wc26", consistency: "strong" });
  const state = await store.get("state", { type: "json" });
  return Response.json({ ok: pinOk(pin, state) });
};

export const config = { path: "/api/admin-auth" };
