const express = require('express');
const cors = require('cors'); // ✅ Import CORS
const app = express();
require('dotenv').config();

const { sequelize, Product, Order, OrderItem } = require('./models'); // Import models

app.use(cors()); // ✅ Enable CORS
app.use(express.json());

// Health check
app.get('/', (req, res) => {
  res.send('eKart Backend is Running');
});

// Get all products
app.get('/products', async (req, res) => {
  try {
    const products = await Product.findAll();
    res.json(products);
  } catch (error) {
    console.error('Failed to fetch products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Add new product
app.post('/products', async (req, res) => {
  const { name, description, price, stock } = req.body;

  if (!name || !price || stock === undefined) {
    return res.status(400).json({ error: 'Missing product fields' });
  }

  try {
    const newProduct = await Product.create({ name, description, price, stock });
    res.status(201).json(newProduct);
  } catch (error) {
    console.error('Failed to add product:', error);
    res.status(500).json({ error: 'Failed to add product' });
  }
});

// Place order
app.post('/orders', async (req, res) => {
  const { user_id, items } = req.body;

  if (!user_id || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Invalid order data' });
  }

  try {
    let total = 0;

    for (const item of items) {
      const product = await Product.findByPk(item.product_id);
      if (!product) return res.status(404).json({ error: `Product ${item.product_id} not found` });
      total += product.price * item.quantity;
    }

    const order = await Order.create({
      user_id,
      total_amount: total.toFixed(2),
    });

    for (const item of items) {
      const product = await Product.findByPk(item.product_id);
      await OrderItem.create({
        order_id: order.id,
        product_id: item.product_id,
        quantity: item.quantity,
        price: product.price,
      });
    }

    res.status(201).json({ message: 'Order placed', order_id: order.id });
  } catch (error) {
    console.error('Failed to place order:', error);
    res.status(500).json({ error: 'Failed to place order' });
  }
});

// Start the server
app.listen(3000, async () => {
  console.log('Server started on http://localhost:3000');
  try {
    await sequelize.authenticate();
    console.log('Database connected!');
    await sequelize.sync({ alter: true });
    console.log('Models synced!');
  } catch (error) {
    console.error('DB connection failed:', error);
  }
});
