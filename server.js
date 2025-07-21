const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const multer = require('multer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const { sequelize, Product, Order, OrderItem, User } = require('./models');

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'yoursecret';

// 🔐 JWT Auth Middleware
function authMiddleware(req, res, next) {
  const auth = req.headers['authorization'];
  if (!auth) return res.status(401).json({ message: 'No token provided' });

  const token = auth.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Invalid token' });
  }
}

// 🧑‍💻 Signup
app.post('/auth/signup', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    const existing = await User.findOne({ where: { email } });
    if (existing) return res.status(400).json({ message: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 10);
    await User.create({ name, email, password: hashed });

    res.status(201).json({ message: 'User created' });
  } catch (err) {
    res.status(500).json({ error: 'Signup failed', detail: err.message });
  }
});

// 🔐 Login
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ where: { email } });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token, name: user.name });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// ✅ Get Current User
app.get('/auth/me', authMiddleware, async (req, res) => {
  const user = await User.findByPk(req.user.id, { attributes: ['id', 'name', 'email'] });
  res.json(user);
});

// 🟢 Health check
app.get('/', (req, res) => {
  res.send('eKart Backend is Running');
});

// 🟢 Get all products
app.get('/products', async (req, res) => {
  try {
    const products = await Product.findAll();
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// 🟢 Add new product
app.post('/products', async (req, res) => {
  const { name, description, price, stock, image_url } = req.body;

  if (!name || !price || stock === undefined) {
    return res.status(400).json({ error: 'Missing product fields' });
  }

  try {
    const newProduct = await Product.create({ name, description, price, stock, image_url });
    res.status(201).json(newProduct);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add product' });
  }
});

// 🟢 Upload product image
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

app.post('/upload', upload.single('image'), (req, res) => {
  const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.json({ url: imageUrl });
});

// 🟢 Place an order (protected)
app.post('/orders', authMiddleware, async (req, res) => {
  const user_id = req.user.id;
  const { items } = req.body;

  if (!Array.isArray(items) || items.length === 0) {
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
    res.status(500).json({ error: 'Failed to place order' });
  }
});

// 🟢 Get order history (protected)
app.get('/orders', authMiddleware, async (req, res) => {
  try {
    const orders = await Order.findAll({
      where: { user_id: req.user.id },
      include: [{ model: OrderItem, include: [Product] }],
      order: [['created_at', 'DESC']]
    });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch orders' });
  }
});

// 🟢 Cancel an order
app.delete('/orders/:id', authMiddleware, async (req, res) => {
  const orderId = req.params.id;
  try {
    const order = await Order.findOne({ where: { id: orderId, user_id: req.user.id } });
    if (!order) return res.status(404).json({ error: 'Order not found or not yours' });

    await OrderItem.destroy({ where: { order_id: orderId } });
    await Order.destroy({ where: { id: orderId } });

    res.json({ message: 'Order cancelled' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});

// 🚀 Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`✅ Server started on http://localhost:${PORT}`);
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected!');
    await sequelize.sync({ alter: true });
    console.log('✅ Models synced!');
  } catch (error) {
    console.error('❌ DB connection failed:', error);
  }
});
