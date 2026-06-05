require('dotenv').config();
const express = require('express');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const bodyParser = require('body-parser');
const sharp = require('sharp');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.json());
app.use(express.static('public'));

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials. Please set SUPABASE_URL and SUPABASE_ANON_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Create admin client with service role key for storage operations
let supabaseAdmin;
if (supabaseServiceKey) {
  supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
} else {
  console.warn('⚠️  SUPABASE_SERVICE_ROLE_KEY not set. Storage uploads will use anon key.');
  supabaseAdmin = supabase;
}

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
    // Check if folders table exists
    const { data: foldersData, error: foldersError } = await supabase
      .from('folders')
      .select('id')
      .limit(1);

    if (foldersError && foldersError.code === 'PGRST116') {
      console.log('⚠️  Folders table not found. Creating table...');
      console.log('\nPlease create the following table in Supabase SQL Editor:\n');
      console.log(`
CREATE TABLE public.folders (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON public.folders
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert" ON public.folders
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update" ON public.folders
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete" ON public.folders
  FOR DELETE USING (true);

CREATE TABLE public.photos (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  url TEXT NOT NULL,
  folder_id TEXT REFERENCES public.folders(id) ON DELETE CASCADE,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON public.photos
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert" ON public.photos
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update" ON public.photos
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete" ON public.photos
  FOR DELETE USING (true);
      `);
      console.log('\nThen create a storage bucket named "photos"\n');
    } else if (!foldersError) {
      console.log('✓ Folders table exists');
    }

    // Check if photos table exists
    const { data: photosData, error: photosError } = await supabase
      .from('photos')
      .select('id')
      .limit(1);

    if (!photosError) {
      console.log('✓ Photos table exists');
    }
  } catch (err) {
    console.error('Database initialization error:', err);
  }
}

// Routes

// Get all folders
app.get('/api/folders', async (req, res) => {
  try {
    const { data: folders, error } = await supabase
      .from('folders')
      .select('*')
      .order('order_index', { ascending: true });

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch folders' });
    }

    res.json(folders || []);
  } catch (err) {
    console.error('Error fetching folders:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create folder (admin)
app.post('/api/admin/folders', async (req, res) => {
  const { token, name } = req.body;
  if (token !== 'admin-token') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Folder name is required' });
  }

  try {
    const folderId = Date.now().toString();
    
    // Get max order index
    const { data: maxOrderData } = await supabaseAdmin
      .from('folders')
      .select('order_index')
      .order('order_index', { ascending: false })
      .limit(1);

    const nextOrderIndex = (maxOrderData && maxOrderData.length > 0) 
      ? maxOrderData[0].order_index + 1 
      : 0;

    const { data: folderData, error: dbError } = await supabaseAdmin
      .from('folders')
      .insert([{
        id: folderId,
        name: name.trim(),
        order_index: nextOrderIndex
      }])
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return res.status(500).json({ error: 'Failed to create folder' });
    }

    res.json(folderData);
  } catch (error) {
    console.error('Create folder error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update folder (admin)
app.put('/api/admin/folders/:id', async (req, res) => {
  const { token, name } = req.body;
  if (token !== 'admin-token') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Folder name is required' });
  }

  const { id } = req.params;

  try {
    const { data: folderData, error: dbError } = await supabaseAdmin
      .from('folders')
      .update({ name: name.trim() })
      .eq('id', id)
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return res.status(500).json({ error: 'Failed to update folder' });
    }

    res.json(folderData);
  } catch (error) {
    console.error('Update folder error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete folder (admin)
app.delete('/api/admin/folders/:id', async (req, res) => {
  const { token } = req.body;
  if (token !== 'admin-token') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { id } = req.params;

  try {
    const { error: deleteError } = await supabaseAdmin
      .from('folders')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Database error:', deleteError);
      return res.status(500).json({ error: 'Failed to delete folder' });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Delete folder error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get photos by folder
app.get('/api/photos/folder/:folderId', async (req, res) => {
  try {
    const { folderId } = req.params;
    const { data: photos, error } = await supabase
      .from('photos')
      .select('*')
      .eq('folder_id', folderId)
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
  const { token, folderId } = req.body;
  if (token !== 'admin-token') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  if (!folderId) {
    return res.status(400).json({ error: 'Folder ID is required' });
  }

  try {
    // Convert image to WebP with high quality for minimal quality loss
    const webpBuffer = await sharp(req.file.buffer)
      .webp({ quality: 85 })
      .toBuffer();

    // Generate filename with .webp extension
    const originalName = path.parse(req.file.originalname).name;
    const fileName = `${Date.now()}-${originalName}.webp`;
    
    // Upload converted WebP to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('photos')
      .upload(`public/${fileName}`, webpBuffer, {
        contentType: 'image/webp',
        upsert: true,
        cacheControl: '3600'
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      console.error('Upload error message:', uploadError.message);
      console.error('Upload error status:', uploadError.status);
      console.error('Full error details:', JSON.stringify(uploadError, null, 2));
      return res.status(500).json({ error: `Failed to upload image: ${uploadError.message}` });
    }
    
    console.log('Upload successful:', uploadData);

    // Get the public URL
    const { data: { publicUrl } } = supabase.storage
      .from('photos')
      .getPublicUrl(`public/${fileName}`);

    // Get max order index for this folder
    const { data: maxOrderData } = await supabaseAdmin
      .from('photos')
      .select('order_index')
      .eq('folder_id', folderId)
      .order('order_index', { ascending: false })
      .limit(1);

    const nextOrderIndex = (maxOrderData && maxOrderData.length > 0) 
      ? maxOrderData[0].order_index + 1 
      : 0;

    // Save metadata to database
    const photoId = Date.now().toString();
    const { data: photoData, error: dbError } = await supabaseAdmin
      .from('photos')
      .insert([
        {
          id: photoId,
          filename: fileName,
          url: publicUrl,
          folder_id: folderId,
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
    const { data: photo, error: selectError } = await supabaseAdmin
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
    const { error: deleteStorageError } = await supabaseAdmin.storage
      .from('photos')
      .remove([`public/${filename}`]);

    if (deleteStorageError) {
      console.error('Storage delete error:', deleteStorageError);
      // Continue anyway to delete from database
    }

    // Delete from database
    const { error: deleteDbError } = await supabaseAdmin
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
      const { error } = await supabaseAdmin
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
