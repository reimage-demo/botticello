import { requireSecurePage, requireHttpsUrl } from "./secure-transport.js";
export const CONVEX_URL =
  import.meta.env?.VITE_CONVEX_URL || "https://sincere-turtle-299.convex.cloud";
export async function call(kind, path, args = {}) {
  requireSecurePage();
  if (!CONVEX_URL.startsWith("https://"))
    throw new Error(
      "Online requests are not available yet. Please call 860-953-5622.",
    );
  const response = await fetch(requireHttpsUrl(`${CONVEX_URL}/api/${kind}`), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ path, args, format: "json" }),
  });
  const data = await response.json();
  if (!response.ok || data.status === "error")
    throw new Error(
      data.errorMessage?.replace(/^.*?Uncaught Error: /s, "").split("\n")[0] ||
        "Something went wrong. Please try again or call the shop.",
    );
  return data.value;
}

export async function uploadPhoto(request, file, slot) {
  requireSecurePage();
  const endpoint = new URL(requireHttpsUrl(CONVEX_URL));
  if (!endpoint.hostname.endsWith(".convex.cloud"))
    throw new Error("Secure photo service is not configured.");
  endpoint.hostname = endpoint.hostname.replace(
    /\.convex\.cloud$/,
    ".convex.site",
  );
  endpoint.pathname = "/customer-photo";
  const response = await fetch(requireHttpsUrl(endpoint.href), {
    method: "POST",
    headers: {
      "Content-Type": file.type,
      "X-Request-Id": request.id,
      "X-Submission-Key": request.submissionKey,
      "X-Photo-Slot": String(slot),
    },
    body: file,
    cache: "no-store",
  });
  if (!response.ok) throw new Error("A photo could not upload. Please retry.");
}
