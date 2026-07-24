#!/usr/bin/env node
// Runs at Netlify build time (see netlify.toml).
//
// Fetches the current Printify catalog and bakes real product cards into
// shop.html and index.html, replacing the "Loading…" ghost placeholder that
// otherwise ships in the static HTML. That placeholder is what search
// engines and anyone without JS see on first load — this script makes sure
// real titles/prices/images are there from the start instead.
//
// The existing client-side fetch in shop.html/index.html still runs in the
// browser afterward and refreshes the grid live — this script doesn't
// replace that, it just gives the page real content to start with.

const fs = require("fs");
const path = require("path");
const { fetchProducts } = require("./lib/printify");

const ROOT = path.join(__dirname, "..");

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function shopCardHtml(p) {
  const title = escapeHtml(p.title);
  return `<div class="record">
        <div class="sleeve">${p.image ? `<img src="${p.image}" alt="${title}" style="width:100%;height:100%;object-fit:cover;">` : ""}</div>
        <p class="cat">In Stock</p>
        <h3>${title}</h3>
        <p class="price">${p.price ? "$" + p.price : ""}</p>
        <a class="buy" href="https://crook-lives.printify.me/products" target="_blank" rel="noopener">Buy Now →</a>
      </div>`;
}

function dropTrackHtml(p, idxLabel) {
  const title = escapeHtml(p.title);
  return `<div class="track">
        <div class="thumb">${p.image ? `<img src="${p.image}" alt="${title}">` : ""}</div>
        <span class="idx">${idxLabel}</span>
        <div>
          <h3>${title}</h3>
          <p>${p.price ? "In stock now — $" + p.price : "In stock now"}</p>
        </div>
        <a class="play" href="https://crook-lives.printify.me/products" target="_blank" rel="noopener" aria-label="Buy ${title}"><svg viewBox="0 0 24 24" fill="var(--ink)"><path d="M8 5v14l11-7z"/></svg></a>
      </div>`;
}

function replaceBetweenMarkers(html, startMarker, endMarker, replacement) {
  const start = html.indexOf(startMarker);
  const end = html.indexOf(endMarker);
  if (start === -1 || end === -1) {
    throw new Error(`Markers ${startMarker} / ${endMarker} not found`);
  }
  return html.slice(0, start + startMarker.length) + "\n" + replacement + "\n" + html.slice(end);
}

async function main() {
  const token = process.env.PRINTIFY_API_TOKEN;
  const shopId = process.env.PRINTIFY_SHOP_ID;

  let products = [];
  try {
    products = await fetchProducts({ token, shopId });
    console.log(`build-products: fetched ${products.length} visible product(s) from Printify`);
  } catch (err) {
    // Don't fail the whole site build over a Printify hiccup — just leave
    // the ghost placeholders in place, same as before this script existed.
    console.warn("build-products: could not fetch Printify catalog, leaving placeholders —", err.message);
    return;
  }

  if (!products.length) {
    console.warn("build-products: Printify returned zero visible products, leaving placeholders");
    return;
  }

  // --- shop.html: full grid ---
  const shopPath = path.join(ROOT, "shop.html");
  let shopHtml = fs.readFileSync(shopPath, "utf8");
  shopHtml = replaceBetweenMarkers(
    shopHtml,
    "<!-- PRODUCTS:START -->",
    "<!-- PRODUCTS:END -->",
    products.map(shopCardHtml).join("\n      ")
  );
  fs.writeFileSync(shopPath, shopHtml);
  console.log("build-products: shop.html updated");

  // --- index.html: featured drop, first 5 items ---
  const indexPath = path.join(ROOT, "index.html");
  let indexHtml = fs.readFileSync(indexPath, "utf8");
  const idxLabels = ["A1", "A2", "A3", "A4", "A5"];
  const featured = products.slice(0, 5);
  indexHtml = replaceBetweenMarkers(
    indexHtml,
    "<!-- DROP:START -->",
    "<!-- DROP:END -->",
    featured.map((p, i) => dropTrackHtml(p, idxLabels[i] || "A" + (i + 1))).join("\n      ")
  );
  fs.writeFileSync(indexPath, indexHtml);
  console.log("build-products: index.html updated");
}

main();
