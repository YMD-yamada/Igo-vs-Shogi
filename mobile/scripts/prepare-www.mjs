import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const repo = join(root, "..");
const www = join(root, "www");
const webDist = join(repo, "apps", "web", "dist");

console.log("Building web for mobile bundle…");
execSync("npm run build:web", { cwd: repo, stdio: "inherit", shell: true });

if (!existsSync(webDist)) {
  console.error("Missing web dist:", webDist);
  process.exit(1);
}

rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });
cpSync(webDist, www, { recursive: true });
console.log("www ready from", webDist);
