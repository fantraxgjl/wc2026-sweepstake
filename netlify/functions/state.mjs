import { getStore } from "@netlify/blobs";

export default async (req) => {
  const store = getStore({ name: "wc26", consistency: "strong" });

  if (req.method === "GET") {
    const data = await store.get("state", { type: "json" });
    return Response.json(data || null);
  }

  if (req.method === "POST") {
    const body = await req.json();
    await store.setJSON("state", body);
    return Response.json({ ok: true });
  }

  if (req.method === "DELETE") {
    await store.delete("state");
    return Response.json({ ok: true });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config = {
  path: "/api/state",
};
