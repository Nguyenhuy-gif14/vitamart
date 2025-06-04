const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const axios = require('axios');

const app = express();
const port = 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// ✅ Kết nối MongoDB local
mongoose.connect('mongodb://127.0.0.1:27017/vitamart', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ Connected to MongoDB'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// Product Schema
const productSchema = new mongoose.Schema({
  _id: String,
  name: String,
  price: Number,
  image: String,
  category: String,
});

const Product = mongoose.model('Product', productSchema);

// Order Schema
const orderSchema = new mongoose.Schema({
  userId: String,
  items: [{
    productId: String,
    name: String,
    quantity: Number,
    price: Number,
  }],
  total: Number,
  date: { type: Date, default: Date.now },
  status: { type: String, default: 'Đang xử lý' },
  paymentUrl: String,
});

const Order = mongoose.model('Order', orderSchema);

// MoMo Config (tạm thời để trống, bạn có thể cập nhật sau)
const PARTNER_CODE = 'YOUR_PARTNER_CODE';
const ACCESS_KEY = 'YOUR_ACCESS_KEY';
const SECRET_KEY = 'YOUR_SECRET_KEY';
const ENDPOINT = 'https://test-payment.momo.vn/v2/gateway/api/create';

const createSignature = (rawSignature) => {
  return crypto.createHmac('sha256', SECRET_KEY)
    .update(rawSignature)
    .digest('hex');
};

// Create payment URL from MoMo
app.post('/api/create-payment', async (req, res) => {
  const { userId, total, orderId } = req.body;

  if (!userId || !total || !orderId) {
    return res.status(400).json({ message: 'Missing required fields' });
  }

  const orderInfo = `Thanh toán đơn hàng #${orderId} từ VitaMart`;
  const returnUrl = 'http://localhost:3000/payment-confirm';
  const notifyUrl = 'http://localhost:5000/api/payment-notify';
  const requestId = orderId;

  const rawSignature = `accessKey=${ACCESS_KEY}&amount=${total}&extraData=&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${PARTNER_CODE}&requestId=${requestId}&returnUrl=${returnUrl}&notifyUrl=${notifyUrl}`;
  const signature = createSignature(rawSignature);

  const requestBody = {
    partnerCode: PARTNER_CODE,
    accessKey: ACCESS_KEY,
    requestId,
    amount: total,
    orderId,
    orderInfo,
    returnUrl,
    notifyUrl,
    extraData: '',
    requestType: 'captureMoMoWallet',
    signature,
  };

  try {
    const response = await axios.post(ENDPOINT, requestBody);
    if (response.data.resultCode === 0) {
      await Order.findByIdAndUpdate(orderId, { paymentUrl: response.data.payUrl });
      res.json({ payUrl: response.data.payUrl });
    } else {
      res.status(400).json({ message: 'Failed to create payment', detail: response.data });
    }
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all products
app.get('/api/products', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get product by ID
app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json(product);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get orders by userId
app.get('/api/orders', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ message: 'Missing userId' });

    const orders = await Order.find({ userId });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create order
app.post('/api/orders', async (req, res) => {
  const { userId, items, total } = req.body;

  if (!userId || !items || items.length === 0 || !total) {
    return res.status(400).json({ message: 'Invalid order data' });
  }

  const order = new Order({ userId, items, total });
  try {
    const newOrder = await order.save();
    res.status(201).json(newOrder);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

// MoMo Notify Handler
app.post('/api/payment-notify', async (req, res) => {
  const {
    partnerCode, orderId, requestId, amount, orderInfo,
    orderType, transId, resultCode, message, payType,
    responseTime, extraData, signature
  } = req.body;

  const rawSignature = `accessKey=${ACCESS_KEY}&amount=${amount}&extraData=${extraData}&message=${message}&orderId=${orderId}&orderInfo=${orderInfo}&orderType=${orderType}&partnerCode=${partnerCode}&payType=${payType}&requestId=${requestId}&responseTime=${responseTime}&resultCode=${resultCode}&transId=${transId}`;
  const computedSignature = createSignature(rawSignature);

  if (computedSignature === signature && resultCode === '0') {
    try {
      await Order.findByIdAndUpdate(orderId, { status: 'Hoàn tất' });
      res.status(200).json({ message: 'Payment confirmed' });
    } catch (err) {
      res.status(500).json({ message: err.message });
    }
  } else {
    res.status(400).json({ message: 'Invalid signature or payment failed' });
  }
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
