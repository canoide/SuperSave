import mongoose from 'mongoose';

const ProductSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  barcode_qr: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  image_url: {
    type: String,
    default: '',
  },
  status: {
    type: String,
    enum: ['pending_approval', 'approved'],
    default: 'pending_approval',
  },
}, {
  timestamps: true,
});

export default mongoose.model('Product', ProductSchema);
