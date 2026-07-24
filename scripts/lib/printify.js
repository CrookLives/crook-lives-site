// Shared Printify fetch/filter logic.
// Used by both netlify/functions/get-products.js (the live, client-side
// refresh that runs in the visitor's browser) and scripts/build-products.js
// (the build-time script that bakes real product HTML into shop.html and
// index.html so it's there on first load, before any JS runs).

let hiddenProductIds = [];
try {
  hiddenProductIds = require("../../netlify/functions/hidden-products.json");
} catch (e) {
  hiddenProductIds = [];
}

async function fetchProducts({ token, shopId }) {
  if (!token || !shopId) {
    throw new Error("Missing PRINTIFY_API_TOKEN or PRINTIFY_SHOP_ID");
  }

  let allRawProducts = [];
  let page = 1;
  let lastPage = 1;

  do {
    const response = await fetch(
      `https://api.printify.com/v1/shops/${shopId}/products.json?page=${page}`,
      {
        headers: {
          "Authorization": `Bearer ${token}`,
          "User-Agent": "CrookLivesSite"
        }
      }
    );

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Printify API error (${response.status}): ${details}`);
    }

    const data = await response.json();
    const pageProducts = Array.isArray(data) ? data : data.data || [];
    allRawProducts = allRawProducts.concat(pageProducts);

    lastPage = data.last_page || 1;
    page += 1;
  } while (page <= lastPage);

  return allRawProducts
    .filter((p) => {
      if (hiddenProductIds.includes(p.id)) return false;
      if (!p.visible) return false;
      const sellableVariants = (p.variants || []).filter(
        (v) => v.is_enabled && v.is_available !== false
      );
      return sellableVariants.length > 0;
    })
    .map((p) => {
      const sellableVariants = (p.variants || []).filter(
        (v) => v.is_enabled && v.is_available !== false
      );
      const prices = sellableVariants
        .map((v) => v.price)
        .filter((price) => typeof price === "number");
      const lowestPriceCents = prices.length ? Math.min(...prices) : null;
      const defaultImage =
        (p.images || []).find((img) => img.is_default) || (p.images || [])[0];

      return {
        id: p.id,
        title: p.title,
        image: defaultImage ? defaultImage.src : null,
        price: lowestPriceCents !== null ? (lowestPriceCents / 100).toFixed(2) : null
      };
    });
}

module.exports = { fetchProducts };
