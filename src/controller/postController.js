const { 
  createPostRecord, 
  fetchCommunityPosts, 
  fetchUserPosts,
  toggleLikeRecord, 
  createCommentRecord 
} = require("../models/postModel");
const { sendSuccess, sendError } = require("../utils/responseHandler");

/**
 * Format relative time (e.g. "2h ago", "Just now")
 */
const formatTimeAgo = (dateStr) => {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

/**
 * Create a new progress post
 */
const createPost = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { caption, before_metric, after_metric } = req.body;

    if (!caption) {
      return sendError(res, "Caption is required.", null, 400);
    }

    if (!req.files || !req.files['before_image'] || !req.files['after_image']) {
      return sendError(res, "Both Before and After images are required.", null, 400);
    }

    const beforeImageFile = req.files['before_image'][0];
    const afterImageFile = req.files['after_image'][0];

    // Build relative URL paths
    const before_image = `uploads/community/${beforeImageFile.filename}`;
    const after_image = `uploads/community/${afterImageFile.filename}`;

    const newPost = await createPostRecord({
      user_id: userId,
      caption,
      before_metric,
      after_metric,
      before_image,
      after_image
    });

    return sendSuccess(res, "Progress post published successfully.", newPost, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve the community feed posts
 */
const getCommunityFeed = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const rawPosts = await fetchCommunityPosts(userId);

    // Map author names and relative times
    const posts = rawPosts.map(post => {
      const comments = (post.comments || []).map(c => ({
        ...c,
        time: formatTimeAgo(c.created_at)
      }));

      return {
        id: post.id,
        user_id: post.user_id,
        caption: post.caption,
        before_metric: post.before_metric,
        after_metric: post.after_metric,
        before_image_path: post.before_image,
        after_image_path: post.after_image,
        likes: post.likes,
        is_liked: post.is_liked,
        author_name: `${post.author_first_name} ${post.author_last_name || ''}`.trim(),
        author_username: post.author_username,
        author_avatar_color: 0xFF2ECC71, // Consistent avatar background
        comments: comments
      };
    });

    return sendSuccess(res, "Community feed retrieved successfully.", posts);
  } catch (error) {
    next(error);
  }
};

/**
 * Toggle like status on a post
 */
const toggleLike = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { postId } = req.params;

    const result = await toggleLikeRecord(postId, userId);
    return sendSuccess(res, result.liked ? "Post liked." : "Post unliked.", result);
  } catch (error) {
    next(error);
  }
};

/**
 * Add a comment to a post
 */
const addComment = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const { postId } = req.params;
    const { content } = req.body;

    if (!content || content.trim() === "") {
      return sendError(res, "Comment content is required.", null, 400);
    }

    const comment = await createCommentRecord(postId, userId, content.trim());
    
    // Map backend created comment format to client format
    const formattedComment = {
      id: comment.id,
      author: comment.author,
      username: comment.username,
      text: comment.content || content,
      time: "Just now"
    };

    return sendSuccess(res, "Comment added successfully.", formattedComment, 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Retrieve posts created by the authenticated user
 */
const getUserPosts = async (req, res, next) => {
  try {
    const userId = req.user.userId;
    const rawPosts = await fetchUserPosts(userId);

    // Map author names and relative times
    const posts = rawPosts.map(post => {
      const comments = (post.comments || []).map(c => ({
        ...c,
        time: formatTimeAgo(c.created_at)
      }));

      return {
        id: post.id,
        user_id: post.user_id,
        caption: post.caption,
        before_metric: post.before_metric,
        after_metric: post.after_metric,
        before_image_path: post.before_image,
        after_image_path: post.after_image,
        likes: post.likes,
        is_liked: post.is_liked,
        author_name: `${post.author_first_name} ${post.author_last_name || ''}`.trim(),
        author_username: post.author_username,
        author_avatar_color: 0xFF2ECC71,
        comments: comments
      };
    });

    return sendSuccess(res, "User posts retrieved successfully.", posts);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createPost,
  getCommunityFeed,
  toggleLike,
  addComment,
  getUserPosts,
};
