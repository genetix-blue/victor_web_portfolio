# Photo Gallery Website with Supabase

A modern photo gallery website with an admin panel for managing photos. Features a responsive grid layout, photo uploads to Supabase storage, and simple password-based authentication.

## Features

- **Responsive Photo Grid**: Beautiful masonry-style grid layout that adapts to all screen sizes
- **Lightbox View**: Click any photo to view in full-screen lightbox
- **Admin Panel**: Password-protected admin dashboard
- **Photo Management**: Upload, delete, and reorder photos
- **Supabase Integration**: 
  - Image storage in Supabase Storage
  - Photo metadata in PostgreSQL database
  - Simple authentication with password
- **File Storage**: Photos stored securely in Supabase

## Prerequisites

- Node.js (v14 or higher)
- npm
- A Supabase account (free tier available at https://supabase.com)

## Quick Start

### 1. Set Up Supabase Project

1. Go to [Supabase](https://supabase.com) and create a new project
2. Wait for the project to initialize
3. Go to **Settings > API** and copy:
   - `Project URL` → Copy to `SUPABASE_URL`
   - `anon` key → Copy to `SUPABASE_ANON_KEY`

### 2. Create Supabase Database Table

1. In Supabase dashboard, go to **SQL Editor**
2. Click **New Query** and paste:

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

3. Click **Execute**

### 3. Create Supabase Storage Bucket

1. In Supabase dashboard, go to **Storage**
2. Click **Create a new bucket**
3. Name it: `photos` (lowercase)
4. Uncheck "Private bucket" (make it public)
5. Click **Create bucket**

### 4. Set Up Local Project

1. Clone or download this project
2. Navigate to project directory:
```bash
cd "Victor Web Portfolio"
```

3. Install dependencies:
```bash
npm install
```

4. Create `.env` file in root directory:
```
SUPABASE_URL=your_project_url_here
SUPABASE_ANON_KEY=your_anon_key_here
ADMIN_PASSWORD=your_strong_password
```

### 5. Run the Application

```bash
npm start
```

Open your browser:
- **Gallery**: http://localhost:3000
- **Admin Panel**: http://localhost:3000/admin

## Usage

### Upload Photos

1. Go to http://localhost:3000/admin
2. Enter admin password
3. Select an image (JPEG, PNG, GIF, WebP)
4. Click "Upload Photo"
5. Photo appears immediately in gallery

### Manage Photos

- **Delete**: Remove photos with the delete button
- **Reorder**: Use up/down arrows to arrange photos
- **View**: Click any photo in gallery for fullscreen view

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Your Supabase project URL |
| `SUPABASE_ANON_KEY` | Yes | Your Supabase public anon key |
| `ADMIN_PASSWORD` | No | Admin panel password (default: admin123) |
| `PORT` | No | Server port (default: 3000) |

## Deployment

### Deploy to Vercel (Recommended)

1. Push project to GitHub
2. Go to [Vercel](https://vercel.com)
3. Click "New Project" and import your repo
4. Add environment variables:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `ADMIN_PASSWORD`
5. Deploy!

### Deploy to Heroku

1. Install Heroku CLI
2. Create Heroku app:
```bash
heroku create your-app-name
heroku config:set SUPABASE_URL=your_url
heroku config:set SUPABASE_ANON_KEY=your_key
heroku config:set ADMIN_PASSWORD=your_password
git push heroku main
```

### Other Hosting Options

- Railway
- Render
- Fly.io
- DigitalOcean
- AWS Elastic Beanstalk

## Security Notes

⚠️ **Important for Production:**

1. **Change Admin Password**: Set a strong, unique password
2. **Use Environment Variables**: Never commit `.env` to version control
3. **HTTPS Only**: Always use HTTPS in production
4. **Rate Limiting**: Consider adding rate limiting to admin endpoints
5. **Backup**: Regularly backup your Supabase database
6. **RLS Policies**: Review Row Level Security policies in Supabase

## Troubleshooting

### "Missing Supabase credentials"
- Make sure `.env` file exists in project root
- Check that `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set
- Restart the server after updating `.env`

### Photos table not found
- Ensure you created the table using the SQL query above
- Check Supabase SQL Editor for any errors

### Storage bucket not found
- Make sure you created the `photos` bucket in Storage
- Ensure bucket is set to "Public"

### Uploads fail
- Check file size (ensure file is not too large)
- Verify file format is supported (JPEG, PNG, GIF, WebP)
- Check Supabase storage quota

### 403 Forbidden errors
- Ensure storage bucket is public
- Check RLS policies on photos table
- Verify `SUPABASE_ANON_KEY` is correct

## API Endpoints

### Public

- `GET /api/photos` - Get all photos sorted by order

### Admin (requires token)

- `POST /api/admin/login` - Authenticate with password
- `POST /api/admin/photos` - Upload new photo
- `DELETE /api/admin/photos/:id` - Delete photo
- `POST /api/admin/photos/reorder` - Update photo order
