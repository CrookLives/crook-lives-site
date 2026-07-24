// Fetches this shop's full product catalog from Printify and returns a
// simplified, filtered list — the browser calls this on page load as a live
// refresh layer on top of the static product HTML that scripts/build-products.js
// bakes into shop.html / index.html at build time.
// Runs server-side so the API token is never exposed to the browser.

const { fetchProducts } = require("../../scripts/lib/printify");

exports.handler = async function (event, context) {
  const token = process.env.PRINTIFY_API_TOKEN;
  const shopId = process.env.PRINTIFY_SHOP_ID;

  try {
    const products = await fetchProducts({ token, shopId });
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300"
      },
      body: JSON.stringify({ products, totalFetched: products.length })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to fetch products", details: err.message })
    };
  }
};
