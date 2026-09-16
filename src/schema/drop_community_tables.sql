-- Optional Migration Script: Remove Community Tables
-- Run this manually against your PostgreSQL database ONLY when you are ready to drop community data.

-- 1. Drop post_comments table (has foreign key to posts and users)
DROP TABLE IF EXISTS post_comments CASCADE;

-- 2. Drop post_likes table (has foreign key to posts and users)
DROP TABLE IF EXISTS post_likes CASCADE;

-- 3. Drop posts table (has foreign key to users)
DROP TABLE IF EXISTS posts CASCADE;
