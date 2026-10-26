import { generateKeyPair, exportPKCS8, exportJWK } from "jose";
import { spawnSync } from "node:child_process";
const existing = spawnSync('npx', ['convex','env','list','--names-only','--prod'], {encoding:'utf8'});
if(existing.status !== 0) { console.error('Unable to inspect authentication configuration.'); process.exit(1); }
if(/JWT_PRIVATE_KEY|JWKS/.test(existing.stdout)) { console.error('Authentication keys already exist. Refusing to replace them.'); process.exit(1); }
const keys = await generateKeyPair("RS256", { extractable: true });
const values = {
  JWT_PRIVATE_KEY: (await exportPKCS8(keys.privateKey))
    .trimEnd()
    .replace(/\n/g, " "),
  JWKS: JSON.stringify({
    keys: [{ use: "sig", ...(await exportJWK(keys.publicKey)) }],
  }),
};
for (const [name, value] of Object.entries(values)) {
  const result = spawnSync("npx", ["convex", "env", "set", name, "--prod"], {
    input: value,
    encoding: "utf8",
  });
  if (result.status !== 0) {
    console.error(`Failed to set ${name}`);
    process.exit(1);
  }
  console.log(`Configured ${name}`);
}
