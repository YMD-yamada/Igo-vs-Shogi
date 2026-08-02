/**
 * Cross-platform Vite launcher for apps/web.
 * Avoids nested `npm run … --` which drops flags on Windows cmd/PowerShell.
 *
 * Usage (from repo root):
 *   node scripts/dev-web.mjs
 *   node scripts/dev-web.mjs --strictPort
 *   npm run dev -- --strictPort
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const webDir = path.join(root, "apps", "web");
const require = createRequire(path.join(webDir, "package.json"));
const vitePkg = require.resolve("vite/package.json");
const viteBin = path.join(path.dirname(vitePkg), "bin", "vite.js");

const extra = process.argv.slice(2);

const hasFlag = (name) => {
  const eq = `${name}=`;
  return extra.some((a) => a === name || a.startsWith(eq));
};

const args = [];
if (!hasFlag("--host")) {
  args.push("--host", "127.0.0.1");
}
if (!hasFlag("--port")) {
  args.push("--port", "5173");
}
args.push(...extra);

const child = spawn(process.execPath, [viteBin, ...args], {
  cwd: webDir,
  stdio: "inherit",
  env: process.env,
  windowsHide: true,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
