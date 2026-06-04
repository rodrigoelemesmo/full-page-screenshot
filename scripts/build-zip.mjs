// Builds the Chrome Web Store package: a zip of runtime files only
// (no tests, no dev config), named with the manifest version.
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, existsSync } from "node:fs";

const RUNTIME = [
  "manifest.json",
  "background.js",
  "editor.js",
  "i18n.js",
  "popup.html",
  "popup.js",
  "options.html",
  "options.js",
  "results.html",
  "results.js",
  "lib",
  "icons",
  "_locales",
];

const { version } = JSON.parse(readFileSync("manifest.json", "utf8"));
const out = `dist/full-page-screenshot-v${version}.zip`;

mkdirSync("dist", { recursive: true });
if (existsSync(out)) rmSync(out);

execFileSync("zip", ["-rq", out, ...RUNTIME, "-x", "*.DS_Store"], { stdio: "inherit" });
console.log(`Built ${out}`);
