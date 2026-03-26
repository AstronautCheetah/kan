// Web Crypto API implementation — works in both Node.js 20+ and Cloudflare Workers

let cachedKey: CryptoKey | null = null;
let cachedSecret: string | null = null;

async function getKey(secret: string): Promise<CryptoKey> {
  if (cachedKey && cachedSecret === secret) return cachedKey;

  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(secret),
  );

  cachedKey = await crypto.subtle.importKey(
    "raw",
    keyMaterial,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
  cachedSecret = secret;

  return cachedKey;
}

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export const encryptToken = async (text: string, secret: string): Promise<string> => {
  const key = await getKey(secret);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(text),
  );

  // AES-GCM in Web Crypto appends the auth tag to the ciphertext
  // Combined: IV (12 bytes) + Ciphertext+AuthTag
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);

  return toBase64Url(combined.buffer);
};

export const decryptToken = async (text: string, secret: string): Promise<string> => {
  const key = await getKey(secret);
  const combined = fromBase64Url(text);

  const iv = combined.slice(0, 12);
  const ciphertext = combined.slice(12); // Includes auth tag

  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext,
  );

  return new TextDecoder().decode(decrypted);
};
