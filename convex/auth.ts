import { convexAuth } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      profile(params) {
        if (params.flow !== "signIn")
          throw new Error(
            "Public account registration is disabled. Contact the shop administrator.",
          );
        return {
          email: String(params.email ?? "")
            .trim()
            .toLowerCase(),
        };
      },
    }),
  ],
});
