require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static('public'));

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Configure multer for memory storage (will upload to Supabase)
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
    }
  }
});

// Initialize database tables
async function initializeDatabase() {
  try {
    // Check if photos table exists by trying to query it
    const { data, error } = await supabase
      .from('photos')
      .select('id')
      .limit(1);

    if (error && error.code === 'PGRST116') {
      // Table doesn't exist
      console.log('⚠️  Photos table not found. Creating table...');
      console.log('\nPlease create the following table in Supabase SQL Editor:\n');
      console.log(`
CREATE TABLE public.photos (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  url TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON public.photos
  FOR SELECT USING (true);
      `);
      console.log('\nThen create a storage bucket named "photos"\n');
    } else if (!error) {
      console.log('✓ Photos table exists');
    }
  } catch (err) {
    console.error('Database initialization error:', err);
  }
}

// Routes


// Serve home page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Serve admin page
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Get all photos
app.get('/api/photos', async (req, res) => {
  try {
    const { data: photos, error } = await supabase
      .from('photos')
      .select('*')
      .order('order_index', { ascending: true });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch photos' });
    }

    res.json(photos || []);
  } catch (err) {
    console.error('Error fetching photos:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Admin login check
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  const adminPassword = (process.env.ADMIN_PASSWORD || 'admin123').trim();
  
  console.log('Login attempt - Password match:', password?.trim() === adminPassword);
  console.log('Stored admin password:', adminPassword);
  
  if (password?.trim() === adminPassword) {
    res.json({ success: true, token: 'admin-token' });
  } else {
    res.json({ success: false });
  }
});

// Add photo (admin)
app.post('/api/admin/photos', upload.single('image'), async (req, res) => {
  const { token } = req.body;
  if (token !== 'admin-token') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const fileName = `${Date.now()}-${req.file.originalname}`;
    
    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('photos')
      .upload(`public/${fileName}`, req.file.buffer, {
        contentType: req.file.mimetype,
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return res.status(500).json({ error: 'Failed to upload image' });
    }

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('photos')
      .getPublicUrl(`public/${fileName}`);

    // Get max order index
    const { data: maxOrderData } = await supabase
      .from('photos')
      .select('order_index')
      .order('order_index', { ascending: false })
      .limit(1);

    const nextOrderIndex = (maxOrderData && maxOrderData.length > 0) 
      ? maxOrderData[0].order_index + 1 
      : 0;

    // Save metadata to database
    const photoId = Date.now().toString();
    const { data: photoData, error: dbError } = await supabase
      .from('photos')
      .insert([
        {
          id: photoId,
          filename: fileName,
          url: publicUrl,
          order_index: nextOrderIndex
        }
      ])
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return res.status(500).json({ error: 'Failed to save photo metadata' });
    }

    res.json(photoData);
  } catch (error) {
    console.error('Upload handler error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete photo (admin)
app.delete('/api/admin/photos/:id', async (req, res) => {
  const { token } = req.body;
  if (token !== 'admin-token') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.params;

  try {
    // Get photo from database
    const { data: photo, error: selectError } = await supabase
      .from('photos')
      .select('*')
      .eq('id', id)
      .single();

    if (selectError || !photo) {
      return res.status(404).json({ error: 'Photo not found' });
    }

    // Extract filename from URL or use stored filename
    const filename = photo.filename;

    // Delete from storage
    const { error: deleteStorageError } = await supabase.storage
      .from('photos')
      .remove([`public/${filename}`]);

    if (deleteStorageError) {
      console.error('Storage delete error:', deleteStorageError);
      // Continue anyway to delete from database
    }

    // Delete from database
    const { error: deleteDbError } = await supabase
      .from('photos')
      .delete()
      .eq('id', id);

    if (deleteDbError) {
      return res.status(500).json({ error: 'Failed to delete photo' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete handler error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update photo order (admin)
app.post('/api/admin/photos/reorder', async (req, res) => {
  const { token, order } = req.body;
  if (token !== 'admin-token') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    // Update order_index for each photo
    for (let i = 0; i < order.length; i++) {
      const { error } = await supabase
        .from('photos')
        .update({ order_index: i })
        .eq('id', order[i]);

      if (error) {
        return res.status(500).json({ error: 'Failed to update order' });
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Reorder handler error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Initialize and start server
initializeDatabase();

app.listen(PORT, () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
  console.log('📸 Gallery: http://localhost:3000');
  console.log('⚙️  Admin: http://localhost:3000/admin');
  console.log('\n📊 Supabase Status:');
  console.log(`   URL: ${supabaseUrl ? '✓ Configured' : '✗ Missing'}`);
  console.log(`   Key: ${supabaseKey ? '✓ Configured' : '✗ Missing'}\n`);
});
