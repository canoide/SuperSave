import express from 'express';
import Product from '../models/Product.js';
import PriceUpdateRequest from '../models/PriceUpdateRequest.js';
import { authenticateJWT } from '../middlewares/auth.js';

const router = express.Router();

// POST /api/prices/suggest - Suggest price update (creates a PriceUpdateRequest)
router.post('/suggest', authenticateJWT, async (req, res) => {
  try {
    const { product_id, store_id, proposed_price } = req.body;

    if (!product_id || !store_id || proposed_price === undefined) {
      return res.status(400).json({ error: 'product_id, store_id, and proposed_price are required' });
    }

    // Validate product exists
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
