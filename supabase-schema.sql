-- ====================================================================
-- INSTAGRAM CONTENT HUB - SUPABASE DATABASE SCHEMA
-- ====================================================================
-- This schema configures the PostgreSQL tables, storage buckets,
-- and Row Level Security (RLS) policies to protect all media assets.

-- 1. Enable pgcrypto for UUID generation (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Create Videos table
CREATE TABLE IF NOT EXISTS public.videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    instagram_url TEXT,
    tags TEXT[] DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'published')),
    publish_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    duration TEXT,
    notes TEXT,
    stats JSONB DEFAULT '{"views": 0, "likes": 0, "comments": 0}'::jsonb,
    attached_video_url TEXT,
    attached_video_name TEXT,
    phash TEXT, -- Storing the perceptual hash value for duplicate checking
    is_favorite BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE
);

-- Indexing for performance and multi-keyword Arabic search
CREATE INDEX IF NOT EXISTS idx_videos_user_id ON public.videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_status ON public.videos(status);
CREATE INDEX IF NOT EXISTS idx_videos_phash ON public.videos(phash);
CREATE INDEX IF NOT EXISTS idx_videos_title_trgm ON public.videos USING gin (to_tsvector('arabic', title));

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- 4. Create Security Policies
-- Policy: Users can only select their own video records
CREATE POLICY "Users can view their own videos" 
    ON public.videos 
    FOR SELECT 
    USING (auth.uid() = user_id);

-- Policy: Users can insert their own video records
CREATE POLICY "Users can create their own videos" 
    ON public.videos 
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own video records
CREATE POLICY "Users can update their own videos" 
    ON public.videos 
    FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own video records
CREATE POLICY "Users can delete their own videos" 
    ON public.videos 
    FOR DELETE 
    USING (auth.uid() = user_id);


-- 5. Set up Storage Bucket for Videos
-- Note: These run on Supabase storage schema. Run this in your Supabase dash or via API:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('videos', 'videos', false);

-- Storage security policies for the 'videos' bucket
-- Policy: Allow authenticated users to upload files to their own directory
-- CREATE POLICY "Allow authenticated uploads" 
--     ON storage.objects FOR INSERT 
--     TO authenticated 
--     WITH CHECK (bucket_id = 'videos');

-- Policy: Allow authenticated users to read files in the bucket
-- CREATE POLICY "Allow authenticated reads" 
--     ON storage.objects FOR SELECT 
--     TO authenticated 
--     USING (bucket_id = 'videos');
