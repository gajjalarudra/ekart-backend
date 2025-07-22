const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
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

// JWT Auth Middleware
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

// Auth Routes
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

app.get('/auth/me', authMiddleware, async (req, res) => {
  const user = await User.findByPk(req.user.id, { attributes: ['id', 'name', 'email'] });
  res.json(user);
});

// Health Check
app.get('/', (req, res) => {
  res.send('eKart Backend is Running');
});

// Multer Storage & File Filter
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`);
  }
});

const fileFilter = (req, file, cb) => {
  const allowed = ['.jpg', '.jpeg', '.png', '.gif'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowed.includes(ext)) {
    return cb(new Error('Only image files are allowed!'), false);
  }
  cb(null, true);
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

// Product Routes
app.get('/products', async (req, res) => {
  try {
    const products = await Product.findAll();
    res.json(products);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

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

app.put('/products/:id', async (req, res) => {
  const { id } = req.params;
  const { name, description, price, stock, image_url } = req.body;

  try {
    const product = await Product.findByPk(id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    await product.update({ name, description, price, stock, image_url });
    res.json({ message: 'Product updated', product });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// ✅ Delete product & its image
app.delete('/products/:id', async (req, res) => {
  const { id } = req.params;

  try {
    const product = await Product.findByPk(id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    // Delete image file from disk
    if (product.image_url && product.image_url.includes('/uploads/')) {
      const filename = product.image_url.split('/uploads/')[1];
      const filePath = path.join(__dirname, 'uploads', filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await product.destroy();
    res.json({ message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

// ✅ Upload image and update product's image_url
app.post('/products/:id/upload-image', upload.single('image'), async (req, res) => {
  const { id } = req.params;
  if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

  try {
    const product = await Product.findByPk(id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    // Delete old image from disk
    if (product.image_url && product.image_url.includes('/uploads/')) {
      const oldFile = product.image_url.split('/uploads/')[1];
      const oldPath = path.join(__dirname, 'uploads', oldFile);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    // Save new image URL
    const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
    await product.update({ image_url: imageUrl });

    res.json({ message: 'Image uploaded', image_url: imageUrl });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Standalone upload endpoint
app.post('/upload', upload.single('image'), (req, res) => {
  const imageUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.json({ url: imageUrl });
});

// Orders
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

// Start Server
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
