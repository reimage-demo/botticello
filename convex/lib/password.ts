import { Scrypt } from "lucia";
import { decode, encode, equal, open, pepperPassword } from "./crypto";
export const ITERATIONS = 600_000;
async function derive(password: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey(
    "raw",
    await pepperPassword(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        hash: "SHA-256",
        salt: new Uint8Array(salt),
        iterations: ITERATIONS,
      },
      material,
      256,
    ),
  );
}
export async function hashPassword(password: string) {
  if (password.length < 14 || password.length > 1024)
    throw new Error("Use a password of 14 to 1024 characters.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2-sha256:v1:${ITERATIONS}:${encode(salt)}:${encode(await derive(password, salt))}`;
}
export async function verifyPassword(password: string, stored: string) {
  if (!password || password.length > 1024) return false;
  // Transitional verifier is encrypted with the server-only pepper. Successful
  // login replaces it with the current peppered PBKDF2 format atomically.
  if (stored.startsWith("legacy-sealed:")) {
    const old = await open<string>(
      stored.slice(14),
      "legacy-password:v1",
      "ADMIN_PASSWORD_PEPPER",
    );
    return new Scrypt().verify(old, password);
  }
  const [algorithm, version, cost, salt, hash] = stored.split(":");
  if (
    algorithm !== "pbkdf2-sha256" ||
    version !== "v1" ||
    Number(cost) !== ITERATIONS
  )
    return false;
  try {
    const saltBytes = decode(salt),
      expected = decode(hash);
    if (saltBytes.length !== 16 || expected.length !== 32) return false;
    return equal(await derive(password, saltBytes), expected);
  } catch {
    return false;
  }
}
