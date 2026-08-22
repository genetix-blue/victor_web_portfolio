# Supabase Setup Guide

This guide will help you set up Supabase for your photo gallery application.

## Step 1: Create a Supabase Account

1. Go to https://supabase.com
2. Click "Start your project"
3. Sign up with your email or GitHub account
4. Create a new organization (or use default)

## Step 2: Create a New Project

1. In your Supabase dashboard, click "New project"
2. Fill in project details:
   - **Name**: Photo Gallery (or your preferred name)
   - **Database Password**: Create a strong password
   - **Region**: Choose closest to you
3. Click "Create new project" and wait for initialization (2-5 minutes)

## Step 3: Get Your API Keys

1. Once project is ready, go to **Settings** (bottom left)
2. Click **API**
3. You'll see:
   - **Project URL** - Copy this to `SUPABASE_URL` in `.env`
   - **Project API keys** section - Look for `anon` key
4. Copy the `anon` key to `SUPABASE_ANON_KEY` in `.env`

## Step 4: Create the Database Table

1. In Supabase dashboard, click **SQL Editor** (left sidebar)
2. Click **New Query**
3. Copy and paste this SQL:

```sql
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
```

Also create the table used to manage the homepage images:

```sql
CREATE TABLE public.landing_images (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  url TEXT NOT NULL,
  order_index INTEGER DEFAULT 0,
  storage_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE public.landing_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read" ON public.landing_images
  FOR SELECT USING (true);
```

4. Click the **Execute** button or press `Ctrl+Enter`
5. You should see "Success!" message

## Step 5: Create Storage Bucket

1. In Supabase dashboard, click **Storage** (left sidebar)
2. Click **Create a new bucket**
3. In the dialog:
   - **Name**: `photos` (must be lowercase)
   - **Privacy**: Make sure "Private bucket" is **UNCHECKED** (public)
4. Click **Create bucket**

## Step 6: Configure Your Application

1. In your project root, open `.env` file
2. Add your Supabase credentials:

```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
ADMIN_PASSWORD=your-strong-password
```

3. Save the file

## Step 7: Run Your Application

```bash
npm install
npm start
```

Your app is now running with Supabase!

## Verify Everything Works

1. Go to http://localhost:3000 (gallery should be empty)
2. Go to http://localhost:3000/admin
3. Login with your admin password
4. Upload a test photo
5. Check that:
   - Photo appears in gallery
   - Photo appears in Supabase Storage dashboard
   - Photo metadata appears in Supabase SQL Editor query:
     ```sql
     SELECT * FROM photos;
     ```

## Troubleshooting

### "Missing Supabase credentials"
- Check that `.env` file exists in root directory
- Verify `SUPABASE_URL` and `SUPABASE_ANON_KEY` are filled in
- Restart the server after updating `.env`

### Photo uploads fail with "Failed to upload image"
- Check that bucket name is exactly `photos` (lowercase)
- Ensure bucket is set to **public** (not private)
- Check that you have storage quota available

### Video uploads fail
- Supported uploads include MP4, MOV, WebM, Matroska, and AVI files
- Videos are converted to compressed WebM files on the server using FFmpeg
- Restart the server after installing dependencies with `npm install`
- Large videos may take longer to process and require additional server memory

### Can't see photos in database
- Verify table was created successfully:
  ```sql
  SELECT * FROM information_schema.tables WHERE table_name = 'photos';
  ```
- Check Row Level Security policies:
  ```sql
  SELECT * FROM pg_policies WHERE tablename = 'photos';
  ```

### Photos show as broken images
- Make sure storage bucket is public
- Try uploading a fresh image
- Check browser console for specific errors

## Security Tips

✅ **Do these:**
- Change admin password to something strong
- Never commit `.env` file to git
- Use HTTPS in production
- Regularly backup important photos

❌ **Don't do these:**
- Share your `SUPABASE_ANON_KEY` publicly
- Use weak admin passwords
- Store sensitive data in photo metadata
- Leave bucket as public in production (if containing private photos)

## Next Steps

Once everything is working:

1. **Customize styling** - Edit `public/styles.css`
2. **Change admin password** - Update `ADMIN_PASSWORD` in `.env`
3. **Deploy** - See README.md for deployment instructions
4. **Backup** - Set up Supabase backups in project settings

## Getting Help

- **Supabase Docs**: https://supabase.com/docs
- **Express Docs**: https://expressjs.com/
- **Project README**: See README.md for more info
