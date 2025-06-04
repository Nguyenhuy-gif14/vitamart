const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// Lấy danh sách sản phẩm
router.get('/', async (req, res) => {
  try {
    const products = await Product.find();
    res.json(products);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Thêm sản phẩm mới
router.post('/', async (req, res) => {
  try {
    const { name, price, category, image, description, stock } = req.body;

    if (!name || !price) {
      return res.status(400).json({ message: 'Thiếu tên hoặc giá sản phẩm' });
    }

    const product = new Product({
      name,
      price,
      category,
      image,
      description,
      stock,
    });

    const newProduct = await product.save();
    res.status(201).json(newProduct);
  } catch (err) {
    res.status(400).json({ message: 'Thêm sản phẩm thất bại', error: err.message });
  }
});

module.exports = router;
