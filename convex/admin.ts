import { query, internalMutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { createAccount, getAuthSessionId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/admin";
export const me = query({
  args: {},
  handler: async (ctx) => {
    try {
      await requireAdmin(ctx);
    } catch {
      return null;
    }
    const session = await ctx.db.get((await getAuthSessionId(ctx))!);
    return {
      expiresAt: Math.min(
        session!.expirationTime,
        session!._creationTime + 30 * 60 * 1000,
      ),
    };
  },
});
export const grant = internalMutation({
  args: { userId: v.id("users"), email: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("admins")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .unique();
    if (existing) await ctx.db.patch(existing._id, { active: true });
    else await ctx.db.insert("admins", { ...args, active: true });
  },
});
// Only callable with deployment administrator credentials, never from the browser.
export const provision = internalAction({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, args) => {
    if (args.password.length < 14)
      throw new Error("Use at least 14 characters.");
    const email = args.email.trim().toLowerCase();
    const { user } = await createAccount(ctx, {
      provider: "password",
      account: { id: email, secret: args.password },
      profile: { email },
    });
    await ctx.runMutation(internal.admin.grant, { userId: user._id, email });
    return { email };
  },
});
