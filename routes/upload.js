// routes/upload.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const router = express.Router();

// Setup multer storage location and filename
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // folder where images will be saved (create this folder)
  },
  filename: (req, file, cb) => {
    // Unique filename: timestamp + original name
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Upload route for single image
router.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).send('No file uploaded.');

  // Return the filename or full URL to the client
  res.json({ filename: req.file.filename });
});

module.exports = router;
