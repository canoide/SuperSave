import mongoose from 'mongoose';

const ProductPriceSchema = new mongoose.Schema({
  product_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  store_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true,
  },
  price: {
    type: Number,
    required: true,
    min: 0,
  },
}, {
  timestamps: { createdAt: false, updatedAt: 'updated_at' },
});

// Compound unique index for quick lookups and prevention of duplicate prices per product in a single store
ProductPriceSchema.index({ product_id: 1, store_id: 1 }, { unique: true });

export default mongoose.model('ProductPrice', ProductPriceSchema);
