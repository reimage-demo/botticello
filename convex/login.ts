import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { hashPassword, verifyPassword } from "./lib/password";
export const LOCK_MS = 30 * 60 * 1000;
export const verify = internalMutation({
  args: { email: v.string(), password: v.string() },
  handler: async (ctx, { email, password }) => {
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", email),
      )
      .unique();
    if (!account) return null;
    const admin = await ctx.db
      .query("admins")
      .withIndex("by_user", (q) => q.eq("userId", account.userId))
      .unique();
    if (!admin?.active) return null;
    const attempt = await ctx.db
      .query("loginAttempts")
      .withIndex("by_account", (q) => q.eq("accountId", account._id))
      .unique();
    if (attempt && attempt.lockedUntil > Date.now()) return null;
    const valid = await verifyPassword(password, account.secret ?? "");
    if (!valid) {
      const failures =
        (attempt && attempt.lockedUntil === 0 ? attempt.failures : 0) + 1;
      const state = {
        failures,
        lockedUntil: failures >= 5 ? Date.now() + LOCK_MS : 0,
      };
      if (attempt) await ctx.db.patch(attempt._id, state);
      else
        await ctx.db.insert("loginAttempts", {
          accountId: account._id,
          ...state,
        });
      // Return rather than throw, so the failed-attempt transaction commits.
      return null;
    }
    if (attempt) await ctx.db.delete(attempt._id);
    if (account.secret?.startsWith("legacy-sealed:"))
      await ctx.db.patch(account._id, { secret: await hashPassword(password) });
    return { userId: account.userId };
  },
});
export const unlock = internalMutation({
  args: { email: v.string() },
  handler: async (ctx, { email }) => {
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q
          .eq("provider", "password")
          .eq("providerAccountId", email.trim().toLowerCase()),
      )
      .unique();
    if (!account) return;
    const state = await ctx.db
      .query("loginAttempts")
      .withIndex("by_account", (q) => q.eq("accountId", account._id))
      .unique();
    if (state) await ctx.db.delete(state._id);
  },
});
