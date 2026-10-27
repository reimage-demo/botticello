const encoder = new TextEncoder();
export const encode = (value: Uint8Array) =>
  btoa(Array.from(value, (b) => String.fromCharCode(b)).join(""));
export const decode = (value: string) =>
  Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
function secret(name: string) {
  const value = process.env[name];
  if (!value) throw new Error("Security configuration is unavailable.");
  const bytes = decode(value);
  if (bytes.length !== 32) throw new Error("Invalid security configuration.");
  return bytes;
}
async function aes(name = "CUSTOMER_DATA_KEY") {
  return crypto.subtle.importKey("raw", secret(name), "AES-GCM", false, [
    "encrypt",
    "decrypt",
  ]);
}
export async function encryptBytes(
  value: Uint8Array,
  purpose: string,
  keyName?: string,
) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv, additionalData: encoder.encode(purpose) },
      await aes(keyName),
      new Uint8Array(value),
    ),
  );
  const result = new Uint8Array(iv.length + encrypted.length);
  result.set(iv);
  result.set(encrypted, iv.length);
  return result;
}
export async function decryptBytes(
  value: Uint8Array,
  purpose: string,
  keyName?: string,
) {
  if (value.length < 28) throw new Error("Invalid encrypted data.");
  return new Uint8Array(
    await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: value.slice(0, 12),
        additionalData: encoder.encode(purpose),
      },
      await aes(keyName),
      value.slice(12),
    ),
  );
}
export async function seal(value: unknown, purpose: string, keyName?: string) {
  return `v1:${encode(await encryptBytes(encoder.encode(JSON.stringify(value)), purpose, keyName))}`;
}
export async function open<T>(
  value: string,
  purpose: string,
  keyName?: string,
): Promise<T> {
  if (!value.startsWith("v1:")) throw new Error("Unknown encryption version.");
  return JSON.parse(
    new TextDecoder().decode(
      await decryptBytes(decode(value.slice(3)), purpose, keyName),
    ),
  );
}
export async function fingerprint(value: string, purpose: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    secret("CUSTOMER_INDEX_KEY"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return encode(
    new Uint8Array(
      await crypto.subtle.sign(
        "HMAC",
        key,
        encoder.encode(`${purpose}\0${value}`),
      ),
    ),
  );
}
export function equal(a: Uint8Array, b: Uint8Array) {
  let difference = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++)
    difference |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return difference === 0;
}
export async function pepperPassword(password: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    secret("ADMIN_PASSWORD_PEPPER"),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(
    await crypto.subtle.sign("HMAC", key, encoder.encode(password)),
  );
}
