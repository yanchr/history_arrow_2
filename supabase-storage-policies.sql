-- Supabase Storage Policies for event-images bucket
-- Run this SQL in your Supabase SQL Editor after creating the event-images bucket
--
-- 1. Create the bucket first in Dashboard: Storage → New bucket → Name: event-images → Public: Yes
-- 2. Run this entire file in SQL Editor

-- Drop existing policies (allows re-running this file)
DROP POLICY IF EXISTS "Authenticated users can upload event images" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for event images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update event images" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete event images" ON storage.objects;

-- Allow authenticated users to upload images
CREATE POLICY "Authenticated users can upload event images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'event-images');

-- Allow public read access (required for public bucket URLs to work)
CREATE POLICY "Public read access for event images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'event-images');

-- Allow authenticated users to update/overwrite their uploads (optional, for editing)
CREATE POLICY "Authenticated users can update event images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'event-images');

-- Allow authenticated users to delete images (optional)
CREATE POLICY "Authenticated users can delete event images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'event-images');
