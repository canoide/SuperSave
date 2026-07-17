import express from 'express';
import Product from '../models/Product.js';
import Store from '../models/Store.js';
import ProductPrice from '../models/ProductPrice.js';
import PriceUpdateRequest from '../models/PriceUpdateRequest.js';
import PriceHistory from '../models/PriceHistory.js';
import { authenticateJWT } from '../middlewares/auth.js';

const router = express.Router();

// GET /api/products/list - Fetch all approved products
router.get('/list', async (req, res) => {
  try {
    const products = await Product.find({ status: 'approved' }).sort({ title: 1 });
    res.json(products);
  } catch (error) {
    console.error('Error listing products:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/products/stores - Fetch all available stores
router.get('/stores', async (req, res) => {
  try {
    const stores = await Store.find({}).sort({ brand: 1, name: 1 });
    res.json(stores);
  } catch (error) {
    console.error('Error listing stores:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/products/history/:productId/:storeId - Fetch price history for a product in a store
router.get('/history/:productId/:storeId', async (req, res) => {
  try {
    const { productId, storeId } = req.params;
    const history = await PriceHistory.find({ product_id: productId, store_id: storeId })
      .sort({ updated_at: 1 }); // Sort chronologically for chart
    res.json(history);
  } catch (error) {
    console.error('Error fetching price history:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/products/:barcode - Find approved product by barcode and return details with current prices at stores
router.get('/:barcode', async (req, res) => {
  try {
    const { barcode } = req.params;

    const product = await Product.findOne({ barcode_qr: barcode, status: 'approved' });
    if (!product) {
      return res.status(404).json({ error: 'Product not found or not approved yet' });
    }

    // Get all current active prices for this product at any store
    const prices = await ProductPrice.find({ product_id: product._id })
      .populate('store_id', 'name brand address location')
      .lean();

    res.json({
      product,
      prices: prices.map(p => ({
        store: p.store_id,
        price: p.price,
        updated_at: p.updated_at,
      })),
    });
  } catch (error) {
    console.error('Error fetching product by barcode:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/products - Suggest new product (starts as 'pending_approval')
router.post('/', authenticateJWT, async (req, res) => {
  try {
    const { title, description, barcode_qr, image_url } = req.body;

    if (!title || !barcode_qr) {
      return res.status(400).json({ error: 'Product title and barcode/QR are required' });
    }

    // Check if barcode already exists
    const existingProduct = await Product.findOne({ barcode_qr });
    if (existingProduct) {
      return res.status(400).json({ error: 'A product with this barcode/QR already exists' });
    }

    const newProduct = new Product({
      title,
      description,
      barcode_qr,
      image_url: image_url || '',
      status: 'pending_approval',
    });

    await newProduct.save();

    res.status(201).json({
      message: 'Product suggestion submitted successfully',
      product: newProduct,
    });
  } catch (error) {
    console.error('Error suggesting product:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/prices/suggest - Suggest price update (creates a PriceUpdateRequest)
router.post('/prices/suggest', authenticateJWT, async (req, res) => {
  try {
    const { product_id, store_id, proposed_price } = req.body;

    if (!product_id || !store_id || proposed_price === undefined) {
      return res.status(400).json({ error: 'product_id, store_id, and proposed_price are required' });
    }

    // Validate product and store exist
    const product = await Product.findById(product_id);
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const newRequest = new PriceUpdateRequest({
      product_id,
      store_id,
      proposed_price: Number(proposed_price),
      submitted_by: req.user.id,
      status: 'pending',
    });

    await newRequest.save();

    res.status(201).json({
      message: 'Price update request submitted successfully',
      request: newRequest,
    });
  } catch (error) {
    console.error('Error suggesting price update:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
