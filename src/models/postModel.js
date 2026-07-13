const pool = require("../config/dbInit");

/**
 * Creates the `posts`, `post_likes`, and `post_comments` tables if they don't exist.
 */
const createCommunityTables = async () => {
  const postsQuery = `
    CREATE TABLE IF NOT EXISTS posts (
      id SERIAL PRIMARY KEY,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      caption TEXT NOT NULL,
      before_metric VARCHAR(100),
      after_metric VARCHAR(100),
      before_image VARCHAR(255),
      after_image VARCHAR(255),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const likesQuery = `
    CREATE TABLE IF NOT EXISTS post_likes (
      post_id INT REFERENCES posts(id) ON DELETE CASCADE,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (post_id, user_id)
    );
  `;

  const commentsQuery = `
    CREATE TABLE IF NOT EXISTS post_comments (
      id SERIAL PRIMARY KEY,
      post_id INT REFERENCES posts(id) ON DELETE CASCADE,
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const idxPostsUser = `CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);`;
  const idxLikesUser = `CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON post_likes(user_id);`;
  const idxCommentsPost = `CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments(post_id);`;
  const idxCommentsUser = `CREATE INDEX IF NOT EXISTS idx_post_comments_user_id ON post_comments(user_id);`;

  try {
    await pool.query(postsQuery);
    await pool.query(likesQuery);
    await pool.query(commentsQuery);
    await pool.query(idxPostsUser);
    await pool.query(idxLikesUser);
    await pool.query(idxCommentsPost);
    await pool.query(idxCommentsUser);
    console.log("Community / Posts tables verified / created successfully.");
  } catch (error) {
    console.error("Error creating community tables:", error);
  }
};

/**
 * Creates a new post in the database
 */
const createPostRecord = async (postData) => {
  const { user_id, caption, before_metric, after_metric, before_image, after_image } = postData;
  const query = `
    INSERT INTO posts (user_id, caption, before_metric, after_metric, before_image, after_image)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *;
  `;
  const values = [user_id, caption, before_metric || null, after_metric || null, before_image || null, after_image || null];
  const result = await pool.query(query, values);
  return result.rows[0];
};

/**
 * Fetches all posts for the community feed with likes count, liked status, and comments list
 */
const fetchCommunityPosts = async (currentUserId, limit = 10, offset = 0) => {
  const query = `
    SELECT 
      p.id,
      p.caption,
      p.before_metric,
      p.after_metric,
      p.before_image,
      p.after_image,
      p.created_at,
      p.user_id,
      u.first_name AS author_first_name,
      u.last_name AS author_last_name,
      u.username AS author_username,
      (SELECT COUNT(*)::int FROM post_likes WHERE post_id = p.id) AS likes,
      EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $1) AS is_liked,
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'id', c.id,
              'content', c.content,
              'created_at', c.created_at,
              'author', TRIM(cu.first_name || ' ' || COALESCE(cu.last_name, '')),
              'username', cu.username
            ) ORDER BY c.created_at ASC
          )
          FROM post_comments c
          JOIN users cu ON c.user_id = cu.id
          WHERE c.post_id = p.id
        ), 
        '[]'::json
      ) AS comments
    FROM posts p
    JOIN users u ON p.user_id = u.id
    ORDER BY p.created_at DESC
    LIMIT $2 OFFSET $3;
  `;
  const result = await pool.query(query, [currentUserId, limit, offset]);
  return result.rows;
};

/**
 * Toggles post like status. Adds if not liked, removes if liked.
 */
const toggleLikeRecord = async (postId, userId) => {
  const checkQuery = `SELECT 1 FROM post_likes WHERE post_id = $1 AND user_id = $2;`;
  const checkResult = await pool.query(checkQuery, [postId, userId]);
  
  if (checkResult.rows.length > 0) {
    const deleteQuery = `DELETE FROM post_likes WHERE post_id = $1 AND user_id = $2;`;
    await pool.query(deleteQuery, [postId, userId]);
    return { liked: false };
  } else {
    const insertQuery = `INSERT INTO post_likes (post_id, user_id) VALUES ($1, $2);`;
    await pool.query(insertQuery, [postId, userId]);
    return { liked: true };
  }
};

/**
 * Creates a comment for a post
 */
const createCommentRecord = async (postId, userId, content) => {
  const insertQuery = `
    INSERT INTO post_comments (post_id, user_id, content)
    VALUES ($1, $2, $3)
    RETURNING id, content, created_at;
  `;
  const insertResult = await pool.query(insertQuery, [postId, userId, content]);
  const newComment = insertResult.rows[0];

  // Get author details
  const authorQuery = `SELECT first_name, last_name, username FROM users WHERE id = $1;`;
  const authorResult = await pool.query(authorQuery, [userId]);
  const author = authorResult.rows[0];

  return {
    id: newComment.id,
    content: newComment.content,
    created_at: newComment.created_at,
    author: `${author.first_name} ${author.last_name || ''}`.trim(),
    username: author.username,
  };
};

/**
 * Fetches all posts created by a specific user (for "My Posts" view)
 */
const fetchUserPosts = async (userId) => {
  const query = `
    SELECT 
      p.id,
      p.caption,
      p.before_metric,
      p.after_metric,
      p.before_image,
      p.after_image,
      p.created_at,
      p.user_id,
      u.first_name AS author_first_name,
      u.last_name AS author_last_name,
      u.username AS author_username,
      (SELECT COUNT(*)::int FROM post_likes WHERE post_id = p.id) AS likes,
      EXISTS(SELECT 1 FROM post_likes WHERE post_id = p.id AND user_id = $1) AS is_liked,
      COALESCE(
        (
          SELECT json_agg(
            json_build_object(
              'id', c.id,
              'content', c.content,
              'created_at', c.created_at,
              'author', TRIM(cu.first_name || ' ' || COALESCE(cu.last_name, '')),
              'username', cu.username
            ) ORDER BY c.created_at ASC
          )
          FROM post_comments c
          JOIN users cu ON c.user_id = cu.id
          WHERE c.post_id = p.id
        ), 
        '[]'::json
      ) AS comments
    FROM posts p
    JOIN users u ON p.user_id = u.id
    WHERE p.user_id = $1
    ORDER BY p.created_at DESC;
  `;
  const result = await pool.query(query, [userId]);
  return result.rows;
};

module.exports = {
  createCommunityTables,
  createPostRecord,
  fetchCommunityPosts,
  fetchUserPosts,
  toggleLikeRecord,
  createCommentRecord,
};
