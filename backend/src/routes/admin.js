import express from 'express';
import Product from '../models/Product.js';
import Store from '../models/Store.js';
import PriceUpdateRequest from '../models/PriceUpdateRequest.js';
import ProductPrice from '../models/ProductPrice.js';
import PriceHistory from '../models/PriceHistory.js';
import { authenticateJWT, requireAdmin } from '../middlewares/auth.js';

const router = express.Router();

// Apply admin protection to all routes in this file
router.use(authenticateJWT, requireAdmin);

// GET /api/admin/pending-products - List products waiting for approval
router.get('/pending-products', async (req, res) => {
  try {
    const products = await Product.find({ status: 'pending_approval' }).sort({ createdAt: -1 });
    res.json(products);
  } catch (error) {
    console.error('Error fetching pending products:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/products/:id/approve - Approve product
router.put('/products/:id/approve', async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { status: 'approved' },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ message: 'Product approved successfully', product });
  } catch (error) {
    console.error('Error approving product:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/products/:id/reject - Reject product
router.put('/products/:id/reject', async (req, res) => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ message: 'Product proposal rejected and deleted', product });
  } catch (error) {
    console.error('Error rejecting product:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/pending-prices - List price update requests
router.get('/pending-prices', async (req, res) => {
  try {
    const requests = await PriceUpdateRequest.find({ status: 'pending' })
      .populate('product_id', 'title barcode_qr image_url')
      .populate('store_id', 'name brand address')
      .populate('submitted_by', 'email')
      .sort({ createdAt: -1 });

    res.json(requests);
  } catch (error) {
    console.error('Error fetching pending prices:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/prices/:id/approve - Approve price update request
router.put('/prices/:id/approve', async (req, res) => {
  try {
    const request = await PriceUpdateRequest.findById(req.params.id);

    if (!request || request.status !== 'pending') {
      return res.status(404).json({ error: 'Pending price request not found' });
    }

    // Mark suggestion as approved
    request.status = 'approved';
    await request.save();

    // 1. Update/Upsert the current price in ProductPrice
    const updatedPrice = await ProductPrice.findOneAndUpdate(
      { product_id: request.product_id, store_id: request.store_id },
      { price: request.proposed_price, updated_at: new Date() },
      { upsert: true, new: true }
    );

    // 2. Add an entry to PriceHistory for chart visualization
    const priceHistory = new PriceHistory({
      product_id: request.product_id,
      store_id: request.store_id,
      price: request.proposed_price,
    });
    await priceHistory.save();

    res.json({
      message: 'Price request approved successfully',
      request,
      current_price: updatedPrice,
    });
  } catch (error) {
    console.error('Error approving price:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/admin/prices/:id/reject - Reject price update request
router.put('/prices/:id/reject', async (req, res) => {
  try {
    const request = await PriceUpdateRequest.findByIdAndUpdate(
      req.params.id,
      { status: 'rejected' },
      { new: true }
    );

    if (!request) {
      return res.status(404).json({ error: 'Price request not found' });
    }

    res.json({ message: 'Price request rejected', request });
  } catch (error) {
    console.error('Error rejecting price:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/admin/stores - List all stores
router.get('/stores', async (req, res) => {
  try {
    const stores = await Store.find({}).sort({ brand: 1, name: 1 });
    res.json(stores);
  } catch (error) {
    console.error('Error fetching stores:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/admin/stores - Create branch
router.post('/stores', async (req, res) => {
  try {
    const { name, brand, address, latitude, longitude } = req.body;

    if (!name || !brand || !address || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: 'All fields are required (name, brand, address, latitude, longitude)' });
    }

    const newStore = new Store({
      name,
      brand,
      address,
      location: {
        type: 'Point',
        coordinates: [Number(longitude), Number(latitude)], // GeoJSON uses [lng, lat]
      },
    });

    await newStore.save();

    res.status(201).json({
      message: 'Store branch created successfully',
      store: newStore,
    });
  } catch (error) {
    console.error('Error creating store:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/admin/stores/:id - Delete store (Baja)
router.delete('/stores/:id', async (req, res) => {
  try {
    const store = await Store.findByIdAndDelete(req.params.id);
    if (!store) {
      return res.status(404).json({ error: 'Store not found' });
    }

    // Clean up current prices and history at this store (optional but recommended)
    await ProductPrice.deleteMany({ store_id: req.params.id });
    await PriceHistory.deleteMany({ store_id: req.params.id });

    res.json({ message: 'Store and all associated prices deleted successfully' });
  } catch (error) {
    console.error('Error deleting store:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
