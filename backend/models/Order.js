const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  products: [{ productId: String, quantity: Number }],
  total: { type: Number, required: true },
  status: { type: String, default: 'pending' },
});

module.exports = mongoose.model('Order', orderSchema);