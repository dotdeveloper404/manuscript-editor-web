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
  // Pricing: monthly price per plan in US dollars; yearly = 12 months minus yearlyDiscount %.
  prices: {
    writer: Number(process.env.PRICE_WRITER || defaults.prices?.writer || 10),
    pro: Number(process.env.PRICE_PRO || defaults.prices?.pro || 20),
    studio: Number(process.env.PRICE_STUDIO || defaults.prices?.studio || 40),
  },
  yearlyDiscount: Number(process.env.YEARLY_DISCOUNT ?? defaults.yearlyDiscount ?? 10),
  // Checkout link per plan and billing period (Lemon Squeezy, Paddle, Gumroad …), e.g. BUY_PRO_YEARLY_URL.
  // Without one, the button emails contactEmail, and without that it reads "Available soon".
  // launchOffer shows a banner above the plans.
  buy: Object.fromEntries(["writer", "pro", "studio"].map((plan) => {
    const saved = defaults.buy?.[plan];
    const pick = (period) => process.env[`BUY_${plan.toUpperCase()}_${period.toUpperCase()}_URL`]
      || (typeof saved === "string" ? saved : saved?.[period]) || "";
    return [plan, { monthly: pick("monthly"), yearly: pick("yearly") }];
  })),
  // PayPal subscriptions on checkout.html: the app's Client ID (public) and a plan ID per plan and period.
  paypal: {
    clientId: process.env.PAYPAL_CLIENT_ID || defaults.paypal?.clientId || "",
    sandbox: (process.env.PAYPAL_SANDBOX ?? String(defaults.paypal?.sandbox ?? true)) === "true",
    plans: Object.fromEntries(["writer", "pro", "studio"].map((plan) => [plan, {
      monthly: process.env[`PAYPAL_${plan.toUpperCase()}_MONTHLY`] || defaults.paypal?.plans?.[plan]?.monthly || "",
      yearly: process.env[`PAYPAL_${plan.toUpperCase()}_YEARLY`] || defaults.paypal?.plans?.[plan]?.yearly || "",
    }])),
  },
  contactEmail: process.env.CONTACT_EMAIL || defaults.contactEmail || "",
  launchOffer: process.env.LAUNCH_OFFER || defaults.launchOffer || "",
};

const problems = [];
const pages = readdirSync(src).filter((f) => f.endsWith(".html"));
const idsOf = Object.fromEntries(pages.map((p) => {
  const html = readFileSync(join(src, p), "utf8");
  return [p, new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]))];
}));
const ids = idsOf["index.html"];
for (const page of pages) {
  const html = readFileSync(join(src, page), "utf8");
  for (const [, target] of html.matchAll(/href="#([^"]*)"/g)) {
    if (target && !idsOf[page].has(target)) problems.push(`${page}: link to #${target} has no matching id`);
  }
  for (const [, ref] of html.matchAll(/(?:src|href)="(?!https?:|#|data:|mailto:)([^"]+)"/g)) {
    const [file, anchor] = ref.split("?")[0].split("#");
    if (file !== "config.js" && !existsSync(join(src, file))) problems.push(`${page}: missing file ${file}`);
    else if (anchor && idsOf[file] && !idsOf[file].has(anchor)) problems.push(`${page}: link to ${file}#${anchor} has no matching id`);
  }
}
const planId = /^P-[A-Z0-9]{10,}$/;
for (const [plan, ids2] of Object.entries(config.paypal.plans)) {
  for (const [period, id] of Object.entries(ids2)) {
    if (id && !planId.test(id)) problems.push(`PayPal plan ID for ${plan} (${period}) should look like P-XXXXXXXX (got "${id}")`);
    if (id && !config.paypal.clientId) problems.push("PayPal plan IDs are set but paypal.clientId is empty");
  }
}
if (config.downloadUrl && !/^https:\/\//.test(config.downloadUrl)) {
  problems.push(`DOWNLOAD_URL must start with https:// (got "${config.downloadUrl}")`);
}
for (const [plan, links] of Object.entries(config.buy)) {
  for (const [period, link] of Object.entries(links)) {
    if (link && !/^https:\/\//.test(link)) problems.push(`Buy link for ${plan} (${period}) must start with https:// (got "${link}")`);
  }
}
for (const [plan, price] of Object.entries(config.prices)) {
  if (!(price > 0)) problems.push(`Monthly price for ${plan} must be a number above 0 (got "${price}")`);
}
if (!(config.yearlyDiscount >= 0 && config.yearlyDiscount < 100)) {
  problems.push(`yearlyDiscount must be a percentage from 0 to 99 (got "${config.yearlyDiscount}")`);
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
