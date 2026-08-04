import assert from "node:assert/strict";
import test from "node:test";

async function worker() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${Math.random()}`);
  return (await import(workerUrl.href)).default;
}

const env = {
  ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
};
const ctx = { waitUntil() {}, passThroughOnException() {} };

test("primary page renders without private seed text", async () => {
  const response = await (await worker()).fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    env,
    ctx,
  );
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.doesNotMatch(html, /Drew|codex-preview/i);
  assert.match(html, /VenusOS/i);
});

test("cross-site mutations fail before storage access", async () => {
  const response = await (await worker()).fetch(
    new Request("https://venus.example/api/delete", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://attacker.example",
        "sec-fetch-site": "cross-site",
      },
      body: JSON.stringify({ confirmation: "DELETE VENUSOS" }),
    }),
    env,
    ctx,
  );
  assert.equal(response.status, 403);
});

test("forged identity headers fail closed off ChatGPT Sites", async () => {
  const response = await (await worker()).fetch(
    new Request("https://venus.example/api/state", {
      headers: { "oai-authenticated-user-email": "attacker@example.com" },
    }),
    env,
    ctx,
  );
  assert.equal(response.status, 401);
});
