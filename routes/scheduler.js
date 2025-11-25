const express = require('express');
const { getSchedulerStatus, triggerManualRun } = require('../services/news-scheduler');
const router = express.Router();

/**
 * GET /api/scheduler/status
 * Get scheduler status
 */
router.get('/status', async (req, res) => {
  try {
    const status = getSchedulerStatus();

    console.log('[Scheduler API] Status requested:', status);

    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('[Scheduler API] Error getting status:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/scheduler/trigger
 * Manually trigger news generation
 */
router.post('/trigger', async (req, res) => {
  try {
    const { maxArticles = 5 } = req.body;

    console.log(`[Scheduler API] Manual trigger requested: ${maxArticles} articles`);

    // Run async, don't wait for completion
    triggerManualRun(maxArticles).then(result => {
      console.log('[Scheduler API] Manual trigger result:', result);
    }).catch(error => {
      console.error('[Scheduler API] Manual trigger error:', error);
    });

    // Return immediately
    res.json({
      success: true,
      message: `News generation started for ${maxArticles} articles. Check logs for progress.`
    });
  } catch (error) {
    console.error('[Scheduler API] Error triggering generation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
