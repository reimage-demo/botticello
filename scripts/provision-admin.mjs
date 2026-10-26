// Reads {email,password} from stdin; never prints credentials.
import { spawnSync } from "node:child_process";
let input = "";
for await (const chunk of process.stdin) input += chunk;
const data = JSON.parse(input);
const result = spawnSync(
  "npx",
  ["convex", "run", "admin:provision", JSON.stringify(data), "--prod"],
  { encoding: "utf8" },
);
if (result.status !== 0) {
  console.error(
    "Admin provisioning failed. Check the Convex authentication configuration.",
  );
  process.exit(1);
}
console.log("Administrator account provisioned.");
