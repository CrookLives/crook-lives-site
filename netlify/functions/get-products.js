// Fetches this shop's full product catalog from Printify (handling pagination)
// and returns a simplified, filtered list for the Shop page to render.
// Runs server-side so the API token is never exposed to the browser.

let hiddenProductIds = [];
try {
  hiddenProductIds = require("./hidden-products.json");
} catch (e) {
  hiddenProductIds = [];
}

exports.handler = async function (event, context) {
  const token = process.env.PRINTIFY_API_TOKEN;
  const shopId = process.env.PRINTIFY_SHOP_ID;

  if (!token || !shopId) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: "Missing PRINTIFY_API_TOKEN or PRINTIFY_SHOP_ID environment variable in Netlify site settings."
      })
    };
  }

  try {
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
        return {
          statusCode: response.status,
          body: JSON.stringify({ error: `Printify API error (${response.status})`, details })
        };
      }

      const data = await response.json();
      const pageProducts = Array.isArray(data) ? data : data.data || [];
      allRawProducts = allRawProducts.concat(pageProducts);

      lastPage = data.last_page || 1;
      page += 1;
    } while (page <= lastPage);

    const products = allRawProducts
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

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300"
      },
      body: JSON.stringify({ products, totalFetched: allRawProducts.length })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to fetch products", details: err.message })
    };
  }
};
