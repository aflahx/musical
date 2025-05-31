const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const fs = require('fs');
const fileUpload = require('express-fileupload');
const cloudinary = require('cloudinary').v2; // Require Cloudinary SDK
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Configure Cloudinary using environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({
  useTempFiles: true, // Use temporary files for uploads
  tempFileDir: '/tmp/' // Specify temp directory
}));
app.use(express.static(path.join(__dirname, 'public')));

// Note: We no longer need a local uploadsDir for persistent storage
// Cloudinary will handle storage. The /uploads route will be removed or repurposed.

// MongoDB Models
// Updated FileSchema to store Cloudinary details
const FileSchema = new mongoose.Schema({
  filename: { type: String, required: true },
  public_id: { type: String, required: true, unique: true }, // Store Cloudinary public ID
  secure_url: { type: String, required: true }, // Store Cloudinary secure URL
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
    
    // Create admin user if it doesn't exist (password should be hashed in a real app)
    const adminExists = await Admin.findOne({ username: 'aflah' });
    if (!adminExists) {
      await Admin.create({ username: 'aflah', password: 'neenu' });
      console.log('Admin user created');
    }
  })
  .catch(err => console.error('MongoDB connection error:', err));

// Admin routes
app.post('/admin/login', async (req, res) => {
  console.log('Login attempt:', req.body);
  const { username, password } = req.body;
  
  if (!username || !password) {
    console.log('Missing username or password');
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const admin = await Admin.findOne({ username, password });
    console.log('Login result:', admin ? 'Success' : 'Failed');
    
    if (admin) {
      res.json({ success: true });
    } else {
      res.status(401).json({ error: 'Invalid username or password' });
    }
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

// Handle file upload with Cloudinary
app.post('/admin/upload', async (req, res) => {
  console.log('Upload request received');
  
  if (!req.files || !req.files.audioFile) {
    console.log('No file in request');
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const file = req.files.audioFile;
  console.log('File received:', file.name, 'Size:', file.size, 'Type:', file.mimetype);

  // Validate file type (Cloudinary can handle many, but good to validate)
  const allowedTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/ogg; codecs=opus'];
  if (!allowedTypes.includes(file.mimetype)) {
    console.log('Invalid file type:', file.mimetype);
    return res.status(400).json({ error: 'Only MP3, WAV, and OGG audio files are allowed' });
  }

  try {
    // Upload file to Cloudinary
    // Use resource_type 'video' for audio files in Cloudinary
    // Specify a folder for organization
    const result = await cloudinary.uploader.upload(file.tempFilePath, {
      resource_type: 'video',
      folder: 'music-player-uploads'
    });
    console.log('Cloudinary upload result:', result);

    // Store file details in MongoDB
    const newFile = await File.create({
      filename: file.name,
      public_id: result.public_id,
      secure_url: result.secure_url,
      uploadDate: new Date()
    });
    console.log('File record created in database:', newFile._id);

    // Clean up the temporary file
    fs.unlink(file.tempFilePath, (err) => {
      if (err) console.error('Error deleting temp file:', err);
    });

    res.json({ id: newFile._id });
  } catch (err) {
    console.error('Upload error:', err);
    // Clean up the temporary file even if upload fails
    if (file.tempFilePath) {
        fs.unlink(file.tempFilePath, (tempErr) => {
            if (tempErr) console.error('Error deleting temp file after error:', tempErr);
        });
    }
    res.status(500).json({ error: err.message });
  }
});

// Delete file with Cloudinary
app.delete('/admin/files/:id', async (req, res) => {
  console.log(`Delete request received for ID: ${req.params.id}`);
  try {
    const fileId = new mongoose.Types.ObjectId(req.params.id);
    const file = await File.findById(fileId);
    if (!file) {
      console.log(`File not found for ID: ${req.params.id}`);
      return res.status(404).json({ error: 'File not found' });
    }

    // Delete file from Cloudinary
    const result = await cloudinary.uploader.destroy(file.public_id, {
        resource_type: 'video' // Specify resource type for audio
    });
    console.log('Cloudinary deletion result:', result);

    // Delete file record from MongoDB
    await File.findByIdAndDelete(fileId);
    await Favorite.deleteOne({ fileId: fileId });
    
    console.log(`File and favorite deleted for ID: ${req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    console.error(`Delete file error for ID: ${req.params.id}`, err);
    res.status(500).json({ error: err.message });
  }
});

// Rename file with Cloudinary
// Cloudinary handles renaming via the API
app.put('/admin/files/:id', async (req, res) => {
  console.log(`Rename request received for ID: ${req.params.id} with body:`, req.body);
  try {
    const fileId = new mongoose.Types.ObjectId(req.params.id);
    const { newFilename } = req.body;
    
    if (!newFilename) {
      console.log('New filename is missing');
      return res.status(400).json({ error: 'New filename is required' });
    }

    const file = await File.findById(fileId);
    
    if (!file) {
      console.log(`File not found for ID: ${req.params.id}`);
      return res.status(404).json({ error: 'File not found' });
    }

    // Rename file in Cloudinary
    // Cloudinary renames by specifying the old public_id and the new public_id
    // We'll use the new filename as the new public_id (without extension)
    const newPublicId = `music-player-uploads/${path.parse(newFilename).name}`;

    // Check if a file with the new public ID already exists in Cloudinary
    // This requires fetching resources, which can be complex. A simpler check
    // is to try renaming and handle Cloudinary's error if the target exists.

    const result = await cloudinary.uploader.rename(file.public_id, newPublicId, {
        resource_type: 'video' // Specify resource type for audio
    });
    console.log('Cloudinary rename result:', result);

    // Update file record in MongoDB with new public_id and secure_url
    file.filename = newFilename;
    file.public_id = result.public_id; // Use the public_id returned by Cloudinary
    file.secure_url = result.secure_url; // Use the secure_url returned by Cloudinary
    await file.save();
    
    console.log(`File renamed for ID: ${req.params.id} to ${newFilename}`);
    res.json({ success: true });
  } catch (err) {
    console.error(`Rename file error for ID: ${req.params.id}`, err);
    // Cloudinary rename might fail if the target public_id already exists
    if (err.http_code === 400 && err.message.includes('already exists')) {
        res.status(400).json({ error: 'File with this name already exists' });
    } else {
        res.status(500).json({ error: err.message });
    }
  }
});

// Get all files (return Cloudinary URL)
app.get('/files', async (req, res) => {
  try {
    // Fetch files including public_id and secure_url
    const files = await File.find({}, 'filename public_id secure_url uploadDate');
    const favorites = await Favorite.find();
    const favoriteIds = favorites.map(f => f.fileId.toString());
    
    const filesWithFavorites = files.map(file => ({
      id: file._id, // Use MongoDB _id as the file identifier
      filename: file.filename,
      secure_url: file.secure_url, // Provide Cloudinary URL for playback
      uploadDate: file.uploadDate,
      isFavorite: favoriteIds.includes(file._id.toString())
    }));
    
    res.json(filesWithFavorites);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Toggle favorite (no change needed for Cloudinary)
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

// Get favorites (return Cloudinary URL)
app.get('/favorites', async (req, res) => {
  try {
    const favorites = await Favorite.find().populate('fileId', 'filename public_id secure_url uploadDate'); // Populate with Cloudinary fields
    res.json(favorites.map(f => ({
        id: f.fileId._id,
        filename: f.fileId.filename,
        secure_url: f.fileId.secure_url,
        uploadDate: f.fileId.uploadDate,
        isFavorite: true // Since it's in favorites list
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Share route (use Cloudinary URL)
app.get('/share/:id', async (req, res) => {
  try {
    const file = await File.findById(req.params.id, 'secure_url'); // Fetch only the secure_url
    if (!file || !file.secure_url) {
      return res.status(404).send('Song not found');
    }
    // Redirect directly to the Cloudinary URL for sharing/playback
    res.redirect(file.secure_url);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Fallback for any other requests to serve the index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 