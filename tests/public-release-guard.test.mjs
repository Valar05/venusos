import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const ignored = new Set(["node_modules", "dist", ".next", ".sites-runtime", ".wrangler", ".git"]);
const forbiddenNames = [
  ".openai/hosting.json",
];
const forbiddenContent = [
  /appgprj_[a-z0-9]+/i,
  /-----BEGIN (?:RSA|OPENSSH|EC|DSA) PRIVATE KEY-----/,
  /(?:API_KEY|ACCESS_TOKEN|CLIENT_SECRET)=[^\s]+/,
];

async function files(directory, prefix = "") {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const relative = path.posix.join(prefix, entry.name);
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...(await files(absolute, relative)));
    else found.push({ absolute, relative });
  }
  return found;
}

test("public source contains no known private release material", async () => {
  const found = await files(root);
  const names = new Set(found.map((file) => file.relative));
  for (const name of forbiddenNames) assert.equal(names.has(name), false, `${name} must not be public`);

  for (const file of found) {
    if (
      file.relative === "tests/public-release-guard.test.mjs" ||
      file.relative === "tests/runtime-boundaries.test.mjs"
    ) continue;
    if (/\.(woff2?|png|jpe?g|gif|ico)$/i.test(file.relative)) continue;
    const content = await readFile(file.absolute, "utf8");
    for (const pattern of forbiddenContent) {
      assert.doesNotMatch(content, pattern, `${file.relative} matched ${pattern}`);
    }
  }
});

test("public environment example contains placeholders only", async () => {
  const example = await readFile(new URL("../.env.example", import.meta.url), "utf8");
  for (const line of example.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    assert.match(line, /^[A-Z0-9_]+=(?:false)?$/, `unexpected configured value: ${line}`);
  }
});
