import { getStore } from "@netlify/blobs";
import { pinOk } from "../auth.mjs";

export default async (req) => {
  const store = getStore({ name: "wc26", consistency: "strong" });

  if (req.method === "GET") {
    const data = await store.get("state", { type: "json" });
    // Never expose the PIN to clients; the admin unlock validates it server-side.
    if (data && typeof data === "object") { const { pin, ...rest } = data; return Response.json(rest); }
    return Response.json(data || null);
  }

  if (req.method === "POST") {
    const body = await req.json();
    const existing = await store.get("state", { type: "json" });
    // Initial setup (no existing sweepstake) is open; once set up, writes need the PIN.
    if (existing?.setupComplete && !pinOk(req.headers.get("x-admin-pin"), existing))
      return Response.json({ ok: false, reason: "bad-pin" }, { status: 403 });
    // GET redacts the pin, so clients can't echo it back — preserve the stored one.
    const next = existing?.pin != null ? { ...body, pin: existing.pin } : body;
    await store.setJSON("state", next);
    return Response.json({ ok: true });
  }

  if (req.method === "DELETE") {
    const existing = await store.get("state", { type: "json" });
    if (existing?.setupComplete && !pinOk(req.headers.get("x-admin-pin"), existing))
      return Response.json({ ok: false, reason: "bad-pin" }, { status: 403 });
    await store.delete("state");
    return Response.json({ ok: true });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config = {
  path: "/api/state",
};
