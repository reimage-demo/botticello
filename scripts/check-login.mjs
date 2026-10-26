import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";
let input = "";
for await (const c of process.stdin) input += c;
const credentials = JSON.parse(input);
const client = new ConvexHttpClient("https://sincere-turtle-299.convex.cloud");
try {
  const result = await client.action(anyApi.auth.signIn, {
    provider: "password",
    params: { ...credentials, flow: "signIn" },
  });
  if (!result.tokens?.token) throw new Error("No session");
  client.setAuth(result.tokens.token);
  if (!(await client.query(anyApi.admin.me, {}))) throw new Error("No access");
  await client.query(anyApi.requests.list, {});
  await client.query(anyApi.inventory.list, {});
  await client.action(anyApi.auth.signOut, {});
  console.log(
    "Production login, admin authorization, requests, inventory, and sign-out verified.",
  );
} catch {
  console.error("Production login verification failed.");
  process.exit(1);
}
