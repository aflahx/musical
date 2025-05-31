const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const fileUpload = require('express-fileupload');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max file size
  useTempFiles: true,
  tempFileDir: '/tmp/'
}));
app.use(express.static(path.join(__dirname, 'public')));

// Use Render's persistent disk for uploads
const uploadsDir = path.join(__dirname, 'uploads');

// Create uploads directory if it doesn't exist
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use('/uploads', express.static(uploadsDir));

// MongoDB Models
const FileSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  uploadDate: { type: Date, default: Date.now }
});

const AdminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true }
});

const FavoriteSchema = new mongoose.Schema({
  fileId: { type: mongoose.Schema.Types.ObjectId, required: true, unique: true }
});

const File = mongoose.model('File', FileSchema);
const Admin = mongoose.model('Admin', AdminSchema);
const Favorite = mongoose.model('Favorite', FavoriteSchema);

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/music-player')
  .then(async () => {
    console.log('Connected to MongoDB');
    
    // Create admin user if it doesn't exist
    const adminExists = await Admin.findOne({ username: 'aflah' });
    if (!adminExists) {
      await Admin.create({ username: 'aflah', password: 'neenu' });
      console.log('Admin user created');
    }
  })
  .catch(err => console.error('MongoDB connection error:', err));

// Admin routes
app.post('/admin/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const admin = await Admin.findOne({ username, password });
    if (admin) {
      res.json({ success: true });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Handle file upload
app.post('/admin/upload', async (req, res) => {
  console.log('Upload request received');
  
  if (!req.files || !req.files.audioFile) {
    console.log('No file in request');
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const file = req.files.audioFile;
  console.log('File received:', file.name, 'Size:', file.size, 'Type:', file.mimetype);

  // Validate file type
  const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/ogg; codecs=opus'];
  if (!allowedTypes.includes(file.mimetype)) {
    console.log('Invalid file type:', file.mimetype);
    return res.status(400).json({ error: 'Only MP3, WAV, and OGG audio files are allowed' });
  }

  const filename = file.name;
  const uploadPath = path.join(uploadsDir, filename);

  try {
    console.log('Moving file to:', uploadPath);
    await file.mv(uploadPath);
    console.log('File moved successfully');

    const newFile = await File.create({
      filename,
      uploadDate: new Date()
    });
    console.log('File record created in database:', newFile._id);

    res.json({ id: newFile._id });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Delete file
app.delete('/admin/files/:id', async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const filePath = path.join(uploadsDir, file.filename);
    fs.unlinkSync(filePath);
    await File.findByIdAndDelete(req.params.id);
    await Favorite.deleteOne({ fileId: req.params.id });
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rename file
app.put('/admin/files/:id', async (req, res) => {
  try {
    const { newFilename } = req.body;
    const file = await File.findById(req.params.id);
    
    if (!file) {
      return res.status(404).json({ error: 'File not found' });
    }

    const oldPath = path.join(uploadsDir, file.filename);
    const newPath = path.join(uploadsDir, newFilename);

    fs.renameSync(oldPath, newPath);
    file.filename = newFilename;
    await file.save();
    
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all files
app.get('/files', async (req, res) => {
  try {
    const files = await File.find();
    const favorites = await Favorite.find();
    const favoriteIds = favorites.map(f => f.fileId.toString());
    
    const filesWithFavorites = files.map(file => ({
      id: file._id,
      filename: file.filename,
      uploadDate: file.uploadDate,
      isFavorite: favoriteIds.includes(file._id.toString())
    }));
    
    res.json(filesWithFavorites);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle favorite
app.post('/files/:id/favorite', async (req, res) => {
  try {
    const { isFavorite } = req.body;
    if (isFavorite) {
      await Favorite.create({ fileId: req.params.id });
    } else {
      await Favorite.deleteOne({ fileId: req.params.id });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get favorites
app.get('/favorites', async (req, res) => {
  try {
    const favorites = await Favorite.find().populate('fileId');
    res.json(favorites.map(f => f.fileId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Share route
app.get('/share/:id', async (req, res) => {
  try {
    const file = await File.findById(req.params.id);
    if (!file) {
      return res.status(404).send('Song not found');
    }
    res.redirect(`/?song=${req.params.id}`);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 