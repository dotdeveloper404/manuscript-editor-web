// Builds the static site into dist/ (no dependencies, Node 18+).
//
// Download settings come from environment variables, so the link can change without editing code:
//   DOWNLOAD_URL   link to ManuscriptEditor-Setup.exe (e.g. a GitHub Release asset). Empty = "coming soon".
//   APP_VERSION    shown under the download button, e.g. "0.9.0 (test build)"
//   DOWNLOAD_SIZE  shown under the download button, e.g. "450 MB"
// Values in site.config.json are used when a variable is not set.
//
// It also checks the page: every "#anchor" link must point to an element that exists,
// and every local file the page references must be in src/. Any problem fails the build.
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "src");
const out = join(root, "dist");
const checkOnly = process.argv.includes("--check");

const defaults = JSON.parse(readFileSync(join(root, "site.config.json"), "utf8"));
const config = {
  downloadUrl: process.env.DOWNLOAD_URL || defaults.downloadUrl || "",
  version: process.env.APP_VERSION || defaults.version || "",
  size: process.env.DOWNLOAD_SIZE || defaults.size || "",
  // Pricing: checkout link per plan (Paddle, Lemon Squeezy, Gumroad …). Without one, the button emails
  // contactEmail, and without that it reads "Available soon". launchOffer shows a banner above the plans.
  buy: {
    writer: process.env.BUY_WRITER_URL || defaults.buy?.writer || "",
    pro: process.env.BUY_PRO_URL || defaults.buy?.pro || "",
    studio: process.env.BUY_STUDIO_URL || defaults.buy?.studio || "",
  },
  contactEmail: process.env.CONTACT_EMAIL || defaults.contactEmail || "",
  launchOffer: process.env.LAUNCH_OFFER || defaults.launchOffer || "",
};

const problems = [];
const html = readFileSync(join(src, "index.html"), "utf8");

const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
for (const [, target] of html.matchAll(/href="#([^"]*)"/g)) {
  if (target && !ids.has(target)) problems.push(`Link to #${target} has no matching id`);
}
for (const [, file] of html.matchAll(/(?:src|href)="(?!https?:|#|data:|mailto:)([^"]+)"/g)) {
  if (file !== "config.js" && !existsSync(join(src, file))) problems.push(`Missing file: ${file}`);
}
if (config.downloadUrl && !/^https:\/\//.test(config.downloadUrl)) {
  problems.push(`DOWNLOAD_URL must start with https:// (got "${config.downloadUrl}")`);
}
for (const [plan, link] of Object.entries(config.buy)) {
  if (link && !/^https:\/\//.test(link)) problems.push(`Buy link for ${plan} must start with https:// (got "${link}")`);
}
if (config.contactEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(config.contactEmail)) {
  problems.push(`contactEmail doesn't look like an email address (got "${config.contactEmail}")`);
}

if (problems.length) {
  console.error("Site check failed:\n  - " + problems.join("\n  - "));
  process.exit(1);
}
console.log(`Site check passed (${ids.size} sections/ids, all links resolve).`);
if (checkOnly) process.exit(0);

// Empty dist/ rather than deleting it, so a terminal or editor open inside it on Windows can't block the build.
mkdirSync(out, { recursive: true });
for (const name of readdirSync(out)) rmSync(join(out, name), { recursive: true, force: true });
cpSync(src, out, { recursive: true });
writeFileSync(join(out, "config.js"), `window.SITE_CONFIG = ${JSON.stringify(config, null, 2)};\n`);

console.log(`Built dist/  download: ${config.downloadUrl || "(not set, button shows 'coming soon')"}`);
