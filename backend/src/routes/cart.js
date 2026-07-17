import express from 'express';
import mongoose from 'mongoose';
import ProductPrice from '../models/ProductPrice.js';
import Product from '../models/Product.js';
import Store from '../models/Store.js';

const router = express.Router();

// Helper to generate all combinations of an array up to size k
function getCombinations(array, k) {
  const result = [];

  function helper(start, combo) {
    if (combo.length > 0 && combo.length <= k) {
      result.push([...combo]);
    }
    if (combo.length === k) {
      return;
    }
    for (let i = start; i < array.length; i++) {
      combo.push(array[i]);
      helper(i + 1, combo);
      combo.pop();
    }
  }

  helper(0, []);
  return result;
}

// POST /api/cart/optimize
router.post('/optimize', async (req, res) => {
  try {
    const { product_ids, max_stores } = req.body;

    if (!product_ids || !Array.isArray(product_ids) || product_ids.length === 0) {
      return res.status(400).json({ error: 'product_ids must be a non-empty array' });
    }

    const maxStoresNum = Number(max_stores) || 1;
    if (maxStoresNum <= 0) {
      return res.status(400).json({ error: 'max_stores must be at least 1' });
    }

    // Convert product IDs to mongoose ObjectId
    const objectProductIds = product_ids.map(id => new mongoose.Types.ObjectId(id));

    // Fetch the products themselves so we can return their details (title, barcode, image)
    const productsDetails = await Product.find({ _id: { $in: objectProductIds } }).lean();
    const productsMap = {};
    productsDetails.forEach(p => {
      productsMap[p._id.toString()] = p;
    });

    // Fetch all current prices for these products across all stores
    const allPrices = await ProductPrice.find({ product_id: { $in: objectProductIds } })
      .populate('store_id')
      .lean();

    if (allPrices.length === 0) {
      return res.status(400).json({
        error: 'No price records found for any of the selected products in any store.',
      });
    }

    // Group product prices by store ID
    // storePricesMap = { storeIdStr: { storeInfo, prices: { productIdStr: priceNumber } } }
    const storePricesMap = {};
    allPrices.forEach(ap => {
      if (!ap.store_id) return; // skip if store was deleted
      const storeIdStr = ap.store_id._id.toString();
      const prodIdStr = ap.product_id.toString();

      if (!storePricesMap[storeIdStr]) {
        storePricesMap[storeIdStr] = {
          store: ap.store_id,
          prices: {},
        };
      }
      storePricesMap[storeIdStr].prices[prodIdStr] = ap.price;
    });

    const storeIds = Object.keys(storePricesMap);

    // Generate all combinations of store IDs of sizes from 1 up to maxStoresNum
    const combinations = getCombinations(storeIds, maxStoresNum);

    let bestCombo = null;
    let bestCoveredCount = -1;
    let bestCost = Infinity;
    let bestSelections = null; // Map of product_id -> { storeId, price }

    const requestedProductIdsStrs = product_ids.map(id => id.toString());

    // Evaluate each combination
    combinations.forEach(combo => {
      let currentCost = 0;
      let currentCoveredCount = 0;
      const currentSelections = {};

      requestedProductIdsStrs.forEach(prodIdStr => {
        let bestPriceForProduct = Infinity;
        let chosenStoreIdForProduct = null;

        // Look for the product in all stores belonging to the current combination
        combo.forEach(storeIdStr => {
          const storeData = storePricesMap[storeIdStr];
          const price = storeData.prices[prodIdStr];
          if (price !== undefined && price < bestPriceForProduct) {
            bestPriceForProduct = price;
            chosenStoreIdForProduct = storeIdStr;
          }
        });

        // If the product is available in at least one store of this combination
        if (chosenStoreIdForProduct !== null) {
          currentCoveredCount++;
          currentCost += bestPriceForProduct;
          currentSelections[prodIdStr] = {
            storeId: chosenStoreIdForProduct,
            price: bestPriceForProduct,
          };
        }
      });

      // We want to maximize coverage of products.
      // If coverages are equal, we want to minimize total cost.
      if (currentCoveredCount > bestCoveredCount) {
        bestCoveredCount = currentCoveredCount;
        bestCost = currentCost;
        bestCombo = combo;
        bestSelections = currentSelections;
      } else if (currentCoveredCount === bestCoveredCount && currentCost < bestCost) {
        bestCost = currentCost;
        bestCombo = combo;
        bestSelections = currentSelections;
      }
    });

    if (!bestCombo) {
      return res.status(400).json({ error: 'Could not find any store combination.' });
    }

    // Now organize the results by selected store
    const selectedStoresData = {};
    bestCombo.forEach(storeIdStr => {
      selectedStoresData[storeIdStr] = {
        store: storePricesMap[storeIdStr].store,
        products: [],
        subtotal: 0,
      };
    });

    const missingProducts = [];

    requestedProductIdsStrs.forEach(prodIdStr => {
      const selection = bestSelections[prodIdStr];
      const productDetail = productsMap[prodIdStr];

      if (selection) {
        const storeIdStr = selection.storeId;
        selectedStoresData[storeIdStr].products.push({
          product_id: prodIdStr,
          title: productDetail ? productDetail.title : 'Unknown Product',
          barcode_qr: productDetail ? productDetail.barcode_qr : '',
          image_url: productDetail ? productDetail.image_url : '',
          price: selection.price,
        });
        selectedStoresData[storeIdStr].subtotal += selection.price;
      } else {
        missingProducts.push({
          product_id: prodIdStr,
          title: productDetail ? productDetail.title : 'Unknown Product',
          barcode_qr: productDetail ? productDetail.barcode_qr : '',
        });
      }
    });

    // Format the response
    const storesToVisit = Object.values(selectedStoresData).filter(s => s.products.length > 0);

    res.json({
      stores_to_visit: storesToVisit,
      missing_products: missingProducts,
      grand_total: Number(bestCost.toFixed(2)),
      coverage_percentage: Number(((bestCoveredCount / requestedProductIdsStrs.length) * 100).toFixed(2)),
    });
  } catch (error) {
    console.error('Error optimizing cart:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
