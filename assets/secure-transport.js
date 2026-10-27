export function requireSecurePage(location = globalThis.location) {
  if (!location) return; // Non-browser tests; all actual requests still require HTTPS.
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(location.hostname);
  if (
    location.protocol !== "https:" &&
    !(local && location.protocol === "http:")
  )
    throw new Error(
      "Open this website using HTTPS before submitting information.",
    );
}
export function requireHttpsUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password)
    throw new Error("An insecure connection was blocked.");
  return url.href;
}
