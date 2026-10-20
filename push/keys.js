// Makes the VAPID key pair of the alerts server. Usage, from push/:
//   npm run keys            the public key goes into wrangler.toml and www/js/prayer.js (PUSH.key); the private key goes
//                           straight into the Worker secret VAPID_PRIVATE_KEY (wrangler secret put), and nowhere else.
//                           Run it after the Worker exists (the first npm run deploy), then deploy again.
//   npm run keys -- --dev   a separate pair for `npm run dev`, written to push/.dev.vars (not in git)
// A new pair makes every browser subscribe again: www/js/prayer.js notices the changed key by itself.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { vapidKeys } from "./src/webpush.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const { publicKey, privateKey } = await vapidKeys();

if (process.argv.includes("--dev")) {
  fs.writeFileSync(path.join(HERE, ".dev.vars"), [
    `VAPID_PUBLIC_KEY=${publicKey}`, `VAPID_PRIVATE_KEY=${privateKey}`,
    "ORIGINS=http://localhost:5173,http://127.0.0.1:5173", "",
  ].join("\n"));
  console.log("✓ push/.dev.vars written. In the app on localhost, point it at the local server (browser console):");
  console.log(`  localStorage.pushServer = JSON.stringify({ url: "http://localhost:8787", key: "${publicKey}" })`);
  process.exit(0);
}

// The secret first: if it fails, nothing else has changed.
const put = spawnSync("npx wrangler secret put VAPID_PRIVATE_KEY", { cwd: HERE, shell: true, input: privateKey, stdio: ["pipe", "inherit", "inherit"] });
if (put.status !== 0) { console.error("✗ wrangler secret put failed: nothing was changed (is the Worker deployed, and are you logged in?)"); process.exit(1); }

const edit = (file, re, value) => {
  const f = path.join(HERE, file), s = fs.readFileSync(f, "utf8");
  if (!re.test(s)) throw new Error(`${file}: no place for the key`);
  fs.writeFileSync(f, s.replace(re, (m, a, b) => a + value + b));
};
edit("wrangler.toml", /^(VAPID_PUBLIC_KEY = ")[^"]*(")/m, publicKey);
edit("../www/js/prayer.js", /(const PUSH = \{ url: "[^"]*", key: ")[^"]*(")/, publicKey);
console.log(`✓ VAPID_PRIVATE_KEY is set on the Worker; public key ${publicKey}\n  written to push/wrangler.toml and www/js/prayer.js. Now: npm run deploy`);
