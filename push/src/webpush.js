/* ===== Web Push with nothing but WebCrypto (Cloudflare Workers, and Node for push/test.js) ===== */
// VAPID (RFC 8292) proves to the browser's push service that the message comes from this server; the message itself
// is encrypted for the browser that subscribed (RFC 8291, "aes128gcm" content coding of RFC 8188), so the push
// service cannot read it.

const te = new TextEncoder();
export const b64u = {
  encode(bytes) {
    let s = ""; for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  },
  decode(text) {
    const s = atob(String(text).replace(/-/g, "+").replace(/_/g, "/") + "===".slice((String(text).length + 3) % 4));
    return Uint8Array.from(s, c => c.charCodeAt(0));
  },
};
const concat = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let i = 0;
  for (const p of parts) { out.set(p, i); i += p.length; }
  return out;
};
// HKDF-SHA-256 (extract and expand) to `bytes` bytes.
async function hkdf(salt, ikm, info, bytes) {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, bytes * 8));
}
// A P-256 key from its raw parts: the public point (65 bytes, 0x04 || x || y) and, for a private key, d (32 bytes).
const jwk = (pub, d) => ({ kty: "EC", crv: "P-256", x: b64u.encode(pub.slice(1, 33)), y: b64u.encode(pub.slice(33, 65)), ...(d ? { d: b64u.encode(d) } : {}), ext: true });

// The server's own ECDH key pair for one run: RFC 8291 lets the server reuse it, the salt is new for every message.
export async function ephemeralKey() {
  const pair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  return { privateKey: pair.privateKey, publicRaw: new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey)) };
}
// For the RFC test vector: a fixed key pair.
export async function importEcdhKey(publicB64, privateB64) {
  const pub = b64u.decode(publicB64);
  const privateKey = await crypto.subtle.importKey("jwk", jwk(pub, b64u.decode(privateB64)), { name: "ECDH", namedCurve: "P-256" }, false, ["deriveBits"]);
  return { privateKey, publicRaw: pub };
}

// The body of a push message for a subscription's keys ({ p256dh, auth }, base64url), in one record of 4096 bytes.
export async function encrypt(plaintext, keys, server, salt = crypto.getRandomValues(new Uint8Array(16))) {
  const uaPublic = b64u.decode(keys.p256dh), auth = b64u.decode(keys.auth);
  if (uaPublic.length !== 65 || auth.length !== 16) throw new Error("bad subscription keys");
  const uaKey = await crypto.subtle.importKey("raw", uaPublic, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const secret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, server.privateKey, 256));
  const ikm = await hkdf(auth, secret, concat(te.encode("WebPush: info\0"), uaPublic, server.publicRaw), 32);
  const cek = await hkdf(salt, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, te.encode("Content-Encoding: nonce\0"), 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const data = concat(typeof plaintext === "string" ? te.encode(plaintext) : plaintext, [2]); // 2: the last (only) record, no padding
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, data));
  const rs = new Uint8Array([0, 0, 16, 0]); // record size 4096
  return concat(salt, rs, [server.publicRaw.length], server.publicRaw, sealed);
}

// VAPID: a signed token per push service (its origin), kept for 12 hours.
export class Vapid {
  constructor(publicKey, privateKey, subject) {
    this.publicKey = publicKey; this.subject = subject; this.tokens = new Map();
    const pub = b64u.decode(publicKey), d = b64u.decode(privateKey);
    if (pub.length !== 65 || d.length !== 32) throw new Error("bad VAPID keys");
    this.key = crypto.subtle.importKey("jwk", jwk(pub, d), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  }
  async header(endpoint, now = Date.now()) {
    const aud = new URL(endpoint).origin; let tk = this.tokens.get(aud);
    if (!tk || tk.exp - 3600 < now / 1000) {
      const exp = Math.floor(now / 1000) + 12 * 3600;
      const part = o => b64u.encode(te.encode(JSON.stringify(o)));
      const unsigned = part({ typ: "JWT", alg: "ES256" }) + "." + part({ aud, exp, sub: this.subject });
      const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, await this.key, te.encode(unsigned)); // r || s, as JWS wants
      tk = { exp, jwt: unsigned + "." + b64u.encode(sig) }; this.tokens.set(aud, tk);
    }
    return `vapid t=${tk.jwt}, k=${this.publicKey}`;
  }
}

// A new key pair for VAPID (push/keys.js): the public key goes to the app, the private key into a Worker secret.
export async function vapidKeys() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign"]);
  const { d } = await crypto.subtle.exportKey("jwk", pair.privateKey);
  return { publicKey: b64u.encode(await crypto.subtle.exportKey("raw", pair.publicKey)), privateKey: d };
}

// Sends one message. Returns the push service's HTTP status (0 when it could not be reached).
export async function send(sub, payload, { vapid, server, ttl, urgency = "high", topic }) {
  const body = await encrypt(payload, sub.keys, server);
  const headers = {
    TTL: String(Math.max(0, Math.round(ttl))), Urgency: urgency, "Content-Encoding": "aes128gcm",
    "Content-Type": "application/octet-stream", Authorization: await vapid.header(sub.endpoint),
    ...(topic ? { Topic: topic } : {}),
  };
  try { const res = await fetch(sub.endpoint, { method: "POST", headers, body }); return res.status; }
  catch { return 0; }
}
