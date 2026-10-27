import { convexAuth } from "@convex-dev/auth/server";
import { ConvexCredentials } from "@convex-dev/auth/providers/ConvexCredentials";
import { internal } from "./_generated/api";
import { hashPassword, verifyPassword } from "./lib/password";
export const SESSION_MS = 30 * 60 * 1000;
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  session: { totalDurationMs: SESSION_MS, inactiveDurationMs: SESSION_MS },
  jwt: { durationMs: 5 * 60 * 1000 },
  providers: [
    ConvexCredentials({
      id: "password",
      authorize: async (params, ctx) => {
        if (
          params.flow !== "signIn" ||
          typeof params.email !== "string" ||
          typeof params.password !== "string" ||
          params.email.length > 200 ||
          params.password.length > 1024
        )
          throw new Error("Unable to sign in.");
        const result = await ctx.runMutation(internal.login.verify, {
          email: params.email.trim().toLowerCase(),
          password: params.password,
        });
        if (!result)
          throw new Error(
            "Unable to sign in. Check your credentials or try again after 30 minutes.",
          );
        return result;
      },
      crypto: { hashSecret: hashPassword, verifySecret: verifyPassword },
    }),
  ],
});
