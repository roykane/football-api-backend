const express = require('express');
const router = express.Router();
const Category = require('../models/Category');

/**
 * GET /api/categories
 * Get all categories
 */
router.get('/', async (req, res) => {
  try {
    const { type, status = 'active', limit = 100, offset = 0 } = req.query;

    let query = { status };
    if (type) {
      query.type = type;
    }

    const categories = await Category.find(query)
      .sort({ order: 1, title: 1 })
      .limit(parseInt(limit))
      .skip(parseInt(offset));

    res.json({
      data: categories,
    });
  } catch (error) {
    console.error('❌ Error fetching categories:', error);
    res.status(500).json({
      error: {
        message: error.message,
      },
    });
  }
});

/**
 * GET /api/categories/:id
 * Get single category
 */
router.get('/:id', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);

    if (!category) {
      return res.status(404).json({
        error: {
          message: 'Category not found',
        },
      });
    }

    res.json({
      data: category,
    });
  } catch (error) {
    console.error('❌ Error fetching category:', error);
    res.status(500).json({
      error: {
        message: error.message,
      },
    });
  }
});

/**
 * POST /api/categories
 * Create new category
 */
router.post('/', async (req, res) => {
  try {
    const category = new Category(req.body);
    await category.save();

    res.status(201).json({
      data: category,
    });
  } catch (error) {
    console.error('❌ Error creating category:', error);
    res.status(500).json({
      error: {
        message: error.message,
      },
    });
  }
});

/**
 * PATCH /api/categories/:id
 * Update category
 */
router.patch('/:id', async (req, res) => {
  try {
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!category) {
      return res.status(404).json({
        error: {
          message: 'Category not found',
        },
      });
    }

    res.json({
      data: category,
    });
  } catch (error) {
    console.error('❌ Error updating category:', error);
    res.status(500).json({
      error: {
        message: error.message,
      },
    });
  }
});

/**
 * DELETE /api/categories/:id
 * Delete category
 */
router.delete('/:id', async (req, res) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);

    if (!category) {
      return res.status(404).json({
        error: {
          message: 'Category not found',
        },
      });
    }

    res.json({
      data: { message: 'Category deleted successfully' },
    });
  } catch (error) {
    console.error('❌ Error deleting category:', error);
    res.status(500).json({
      error: {
        message: error.message,
      },
    });
  }
});

module.exports = router;
