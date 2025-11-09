const express = require('express');
const router = express.Router();
const Post = require('../models/Post');
const Category = require('../models/Category');

/**
 * GET /api/posts
 * Mimics Directus API: GET /items/posts?fields=category.*&filter[status][_eq]=published
 */
router.get('/', async (req, res) => {
  try {
    const { fields, filter, limit = 100, offset = 0, sort } = req.query;

    // Build filter
    let query = {};
    if (filter) {
      // Parse Directus-style filter
      // Example: filter[status][_eq]=published -> { status: 'published' }
      if (filter.status && filter.status._eq) {
        query.status = filter.status._eq;
      }
    }

    // Fetch posts with populated category
    const posts = await Post.find(query)
      .populate('category')
      .limit(parseInt(limit))
      .skip(parseInt(offset))
      .sort(sort || { createdAt: -1 });

    // Format response to match Directus structure
    const formattedPosts = posts.map(post => ({
      id: post._id,
      title: post.title,
      slug: post.slug,
      content: post.content,
      excerpt: post.excerpt,
      status: post.status,
      author: post.author,
      featuredImage: post.featuredImage,
      tags: post.tags,
      viewCount: post.viewCount,
      category: post.category ? {
        id: post.category._id,
        title: post.category.title,
        slug: post.category.slug,
        type: post.category.type,
        description: post.category.description,
        order: post.category.order,
        status: post.category.status,
      } : null,
      createdAt: post.createdAt,
      updatedAt: post.updatedAt,
    }));

    res.json({
      data: formattedPosts,
    });
  } catch (error) {
    console.error('❌ Error fetching posts:', error);
    res.status(500).json({
      error: {
        message: error.message,
      },
    });
  }
});

/**
 * GET /api/posts/:id
 * Get single post by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const post = await Post.findById(req.params.id).populate('category');

    if (!post) {
      return res.status(404).json({
        error: {
          message: 'Post not found',
        },
      });
    }

    res.json({
      data: {
        id: post._id,
        title: post.title,
        slug: post.slug,
        content: post.content,
        excerpt: post.excerpt,
        status: post.status,
        author: post.author,
        featuredImage: post.featuredImage,
        tags: post.tags,
        viewCount: post.viewCount,
        category: post.category ? {
          id: post.category._id,
          title: post.category.title,
          slug: post.category.slug,
          type: post.category.type,
          description: post.category.description,
        } : null,
        createdAt: post.createdAt,
        updatedAt: post.updatedAt,
      },
    });
  } catch (error) {
    console.error('❌ Error fetching post:', error);
    res.status(500).json({
      error: {
        message: error.message,
      },
    });
  }
});

/**
 * POST /api/posts
 * Create new post
 */
router.post('/', async (req, res) => {
  try {
    const post = new Post(req.body);
    await post.save();
    await post.populate('category');

    res.status(201).json({
      data: post,
    });
  } catch (error) {
    console.error('❌ Error creating post:', error);
    res.status(500).json({
      error: {
        message: error.message,
      },
    });
  }
});

/**
 * PATCH /api/posts/:id
 * Update post
 */
router.patch('/:id', async (req, res) => {
  try {
    const post = await Post.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    ).populate('category');

    if (!post) {
      return res.status(404).json({
        error: {
          message: 'Post not found',
        },
      });
    }

    res.json({
      data: post,
    });
  } catch (error) {
    console.error('❌ Error updating post:', error);
    res.status(500).json({
      error: {
        message: error.message,
      },
    });
  }
});

/**
 * DELETE /api/posts/:id
 * Delete post
 */
router.delete('/:id', async (req, res) => {
  try {
    const post = await Post.findByIdAndDelete(req.params.id);

    if (!post) {
      return res.status(404).json({
        error: {
          message: 'Post not found',
        },
      });
    }

    res.json({
      data: { message: 'Post deleted successfully' },
    });
  } catch (error) {
    console.error('❌ Error deleting post:', error);
    res.status(500).json({
      error: {
        message: error.message,
      },
    });
  }
});

module.exports = router;
