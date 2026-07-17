import mongoose from 'mongoose';

const PriceUpdateRequestSchema = new mongoose.Schema({
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
  proposed_price: {
    type: Number,
    required: true,
    min: 0,
  },
  submitted_by: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
}, {
  timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
});

export default mongoose.model('PriceUpdateRequest', PriceUpdateRequestSchema);
