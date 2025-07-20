const express = require('express');
const app = express();
require('dotenv').config();
const { sequelize } = require('./models');

app.use(express.json());

app.get('/', (req, res) => {
  res.send('eKart Backend is Running');
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
