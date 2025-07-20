const express = require('express');
const app = express();
require('dotenv').config();
const { sequelize, Product } = require('./models');  // Import Product model

app.use(express.json());

app.get('/', (req, res) => {
  res.send('eKart Backend is Running');
});

// Add this route to get all products
app.get('/products', async (req, res) => {
  try {
    const products = await Product.findAll();
    res.json(products);
  } catch (error) {
    console.error('Failed to fetch products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

app.listen(3000, async () => {
  console.log('Server started on http://localhost:3000');
  try {
    await sequelize.authenticate();
    console.log('Database connected!');
  } catch (error) {
    console.error('DB connection failed:', error);
  }
});
