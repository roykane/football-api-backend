const express = require('express');
const router = express.Router();
const SoiKeoArticle = require('../models/SoiKeoArticle');
const soiKeoGenerator = require('../services/soi-keo-generator');

// ========================================
// GET /api/soi-keo - Get all articles
// ========================================
router.get('/', async (req, res) => {
  try {
    const { limit = 10, page = 1, league, upcoming } = req.query;

    const query = { status: 'published' };

    // Filter by league
    if (league) {
      query['matchInfo.league.id'] = parseInt(league);
    }

    // Filter upcoming matches only
    if (upcoming === 'true') {
      query['matchInfo.matchDate'] = { $gte: new Date() };
    }

    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const [articles, total] = await Promise.all([
      SoiKeoArticle.find(query)
        .sort({ 'matchInfo.matchDate': 1, createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      SoiKeoArticle.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: {
        items: articles,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
          hasMore: skip + articles.length < total
        }
      }
    });

  } catch (error) {
    console.error('[SoiKeo] Error fetching articles:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// GET /api/soi-keo/upcoming - Get upcoming match articles
// ========================================
router.get('/upcoming', async (req, res) => {
  try {
    const { limit = 5 } = req.query;
    const articles = await SoiKeoArticle.getUpcoming(parseInt(limit));

    res.json({
      success: true,
      data: articles
    });

  } catch (error) {
    console.error('[SoiKeo] Error fetching upcoming:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// GET /api/soi-keo/hot - Get most viewed articles with pagination
// ========================================
router.get('/hot', async (req, res) => {
  try {
    const { limit = 10, page = 1 } = req.query;
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    const query = { status: 'published' };

    const [articles, total] = await Promise.all([
      SoiKeoArticle.find(query)
        .sort({ createdAt: -1, 'matchInfo.matchDate': 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      SoiKeoArticle.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: articles,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        hasMore: skip + articles.length < total
      }
    });

  } catch (error) {
    console.error('[SoiKeo] Error fetching hot articles:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// GET /api/soi-keo/fixture/:fixtureId - Get article by fixture ID
// ========================================
router.get('/fixture/:fixtureId', async (req, res) => {
  try {
    const { fixtureId } = req.params;
    const article = await SoiKeoArticle.getByFixtureId(parseInt(fixtureId));

    if (!article) {
      return res.status(404).json({
        success: false,
        error: 'Article not found for this fixture'
      });
    }

    // Increment views
    await SoiKeoArticle.updateOne(
      { fixtureId: parseInt(fixtureId) },
      { $inc: { views: 1 } }
    );

    res.json({
      success: true,
      data: article
    });

  } catch (error) {
    console.error('[SoiKeo] Error fetching by fixture:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// GET /api/soi-keo/:slug - Get article by slug
// ========================================
router.get('/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    // Check if it's an ObjectId (fallback for old links)
    if (slug.match(/^[0-9a-fA-F]{24}$/)) {
      const article = await SoiKeoArticle.findById(slug).lean();

      if (!article) {
        return res.status(404).json({
          success: false,
          error: 'Article not found'
        });
      }

      // Increment views
      await SoiKeoArticle.updateOne({ _id: slug }, { $inc: { views: 1 } });

      return res.json({
        success: true,
        data: article
      });
    }

    // Find by slug
    const article = await SoiKeoArticle.getBySlug(slug);

    if (!article) {
      return res.status(404).json({
        success: false,
        error: 'Article not found'
      });
    }

    // Increment views
    await SoiKeoArticle.updateOne({ slug }, { $inc: { views: 1 } });

    res.json({
      success: true,
      data: article
    });

  } catch (error) {
    console.error('[SoiKeo] Error fetching article:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// POST /api/soi-keo/generate - Trigger manual generation
// ========================================
router.post('/generate', async (req, res) => {
  try {
    const { fixtureId, maxArticles = 5 } = req.body;

    // If specific fixture ID provided, generate for that fixture
    if (fixtureId) {
      console.log(`[SoiKeo] Manual generation triggered for fixture ${fixtureId}`);

      const article = await soiKeoGenerator.generateForFixture(parseInt(fixtureId));

      if (article) {
        return res.json({
          success: true,
          message: 'Article generated successfully',
          data: article
        });
      } else {
        return res.json({
          success: false,
          message: 'Failed to generate article or already exists'
        });
      }
    }

    // Otherwise, run the normal generation process
    console.log('[SoiKeo] Manual batch generation triggered');
    const result = await soiKeoGenerator.run(parseInt(maxArticles));

    res.json({
      success: result.success,
      message: result.message || `Generated ${result.generated} articles`,
      data: result
    });

  } catch (error) {
    console.error('[SoiKeo] Manual generation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// POST /api/soi-keo/cleanup - Delete old articles (7+ days old)
// ========================================
router.post('/cleanup', async (req, res) => {
  try {
    const { daysOld = 7, dryRun = false } = req.body;

    // Count how many would be deleted
    const countToDelete = await SoiKeoArticle.countOldArticles(parseInt(daysOld));

    if (dryRun) {
      return res.json({
        success: true,
        dryRun: true,
        message: `Would delete ${countToDelete} articles older than ${daysOld} days`,
        countToDelete
      });
    }

    // Perform actual deletion
    const result = await SoiKeoArticle.cleanupOldArticles(parseInt(daysOld));

    console.log(`[SoiKeo] Cleanup: Deleted ${result.deleted} articles older than ${daysOld} days`);

    res.json({
      success: true,
      message: `Deleted ${result.deleted} articles older than ${daysOld} days`,
      deleted: result.deleted,
      cutoffDate: result.cutoffDate
    });

  } catch (error) {
    console.error('[SoiKeo] Cleanup error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ========================================
// GET /api/soi-keo/stats/overview - Get statistics
// ========================================
router.get('/stats/overview', async (req, res) => {
  try {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const [total, todayCount, upcomingCount, totalViews] = await Promise.all([
      SoiKeoArticle.countDocuments({ status: 'published' }),
      SoiKeoArticle.countDocuments({ generatedAt: { $gte: startOfDay } }),
      SoiKeoArticle.countDocuments({
        status: 'published',
        'matchInfo.matchDate': { $gte: now }
      }),
      SoiKeoArticle.aggregate([
        { $match: { status: 'published' } },
        { $group: { _id: null, totalViews: { $sum: '$views' } } }
      ])
    ]);

    res.json({
      success: true,
      data: {
        total,
        generatedToday: todayCount,
        upcoming: upcomingCount,
        totalViews: totalViews[0]?.totalViews || 0,
        dailyLimit: 5
      }
    });

  } catch (error) {
    console.error('[SoiKeo] Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
