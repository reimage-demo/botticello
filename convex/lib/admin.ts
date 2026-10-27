import { getAuthSessionId, getAuthUserId } from "@convex-dev/auth/server";
import type { QueryCtx, MutationCtx } from "../_generated/server";
export async function requireAdmin(ctx: QueryCtx | MutationCtx) {
  const id = await getAuthUserId(ctx);
  if (!id) throw new Error("Sign in required.");
  const admin = await ctx.db
    .query("admins")
    .withIndex("by_user", (q) => q.eq("userId", id))
    .unique();
  if (!admin?.active) throw new Error("Administrator access required.");
  const sessionId = await getAuthSessionId(ctx);
  const session = sessionId ? await ctx.db.get(sessionId) : null;
  if (
    !session ||
    session.userId !== id ||
    Math.min(session.expirationTime, session._creationTime + 30 * 60 * 1000) <=
      Date.now()
  )
    throw new Error("Session expired. Sign in again.");
  return id;
}
export function bounded(value: string, label: string, max = 200) {
  const s = value.trim();
  if (!s || s.length > max)
    throw new Error(
      `${label} is required and must be under ${max} characters.`,
    );
  return s;
}
export async function validatePhotos(
  ctx: MutationCtx,
  ids: import("../_generated/dataModel").Id<"_storage">[],
) {
  if (ids.length > 6 || new Set(ids).size !== ids.length)
    throw new Error("Use up to six unique photos.");
  for (const id of ids) {
    const f = await ctx.db.system.get(id);
    if (
      !f ||
      f.size > 8 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(f.contentType ?? "")
    )
      throw new Error("Photos must be JPEG, PNG, or WebP under 8 MB.");
  }
}
