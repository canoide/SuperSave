import mongoose from 'mongoose';

const PriceHistorySchema = new mongoose.Schema({
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
  timestamps: { createdAt: 'updated_at', updatedAt: false }, // only track when price record was created
});

export default mongoose.model('PriceHistory', PriceHistorySchema);
