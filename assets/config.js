export const CONVEX_URL = import.meta.env.VITE_CONVEX_URL || "";
export async function call(kind, path, args = {}) {
  if (!CONVEX_URL.startsWith("https://"))
    throw new Error(
      "Online requests are not available yet. Please call 860-953-5622.",
    );
  const response = await fetch(`${CONVEX_URL}/api/${kind}`, {
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
