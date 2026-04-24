/**
 * Admin CRUD for all auto-generated article collections.
 *
 * Three physical collections are unified behind one URL shape:
 *   Article         → collection = 'article'       (tin-bong-da)
 *   SoiKeoArticle   → collection = 'soi-keo'       (nhan-dinh)
 *   AutoArticle     → collection = 'auto'          (preview / doi-dau)
 *
 * Endpoints (all require admin cookie):
 *   GET    /                              list across collections, filter + paginate
 *   GET    /:collection/:id               fetch one (for edit form)
 *   PATCH  /:collection/:id               update whitelisted fields
 *   POST   /:collection/:id/image         upload hero image (base64 in JSON body)
 *
 * Image upload is kept simple: client sends { dataUrl: "data:image/png;base64,..." }.
 * We decode, write to /public/article-images/<id>-admin.<ext>, point article.image
 * (or .thumbnail for soi-keo) at it, and stamp imageReviewed=true.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const Article = require('../models/Article');
const SoiKeoArticle = require('../models/SoiKeoArticle');
const AutoArticle = require('../models/AutoArticle');

const { requireAdmin } = require('./adminAuth');

const router = express.Router();

// All admin routes require auth.
router.use(requireAdmin);

const UPLOAD_DIR = path.join(__dirname, '..', 'public', 'article-images');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// Map external collection key → Mongoose model + image field name + frontend URL prefix.
const COLLECTIONS = {
  article: {
    model: Article,
    label: 'Tin bóng đá',
    imageField: 'image',
    urlPrefix: '/tin-bong-da/',
    // Fields allowed in PATCH body.
    patchable: ['title', 'description', 'content', 'image', 'tags', 'status',
                'contentReviewed', 'imageReviewed'],
  },
  'soi-keo': {
    model: SoiKeoArticle,
    label: 'Nhận định',
    imageField: 'thumbnail',
    urlPrefix: '/nhan-dinh/',
    patchable: ['title', 'excerpt', 'content', 'thumbnail', 'tags', 'status',
                'contentReviewed', 'imageReviewed'],
  },
  auto: {
    model: AutoArticle,
    label: 'Preview / Đối đầu',
    imageField: 'thumbnail',
    // URL prefix depends on .type; resolved per-row in shapeListRow().
    urlPrefix: null,
    patchable: ['title', 'excerpt', 'content', 'thumbnail', 'tags', 'status',
                'contentReviewed', 'imageReviewed'],
  },
};

function cfgFor(collection) {
  return COLLECTIONS[collection] || null;
}

/**
 * Flatten a row from any collection to a common list shape.
 * Small payload: enough for the list UI, not the full content.
 */
function shapeListRow(doc, collectionKey) {
  const cfg = cfgFor(collectionKey);
  const obj = doc.toObject ? doc.toObject() : doc;
  let url = '#';
  if (collectionKey === 'auto') {
    // AutoArticle uses .type ('round-preview' vs 'h2h-analysis') to pick the page.
    const base = obj.type === 'h2h-analysis' ? '/doi-dau/' : '/preview/';
    url = obj.slug ? `${base}${obj.slug}` : '#';
  } else if (cfg?.urlPrefix) {
    url = obj.slug ? `${cfg.urlPrefix}${obj.slug}` : '#';
  }
  return {
    collection: collectionKey,
    _id: String(obj._id),
    title: obj.title,
    slug: obj.slug,
    url,
    image: obj[cfg.imageField] || null,
    status: obj.status,
    source: obj.source || obj.type || null,
    createdAt: obj.createdAt,
    updatedAt: obj.updatedAt,
    contentReviewed: !!obj.contentReviewed,
    imageReviewed: !!obj.imageReviewed,
    reviewedAt: obj.reviewedAt || null,
    league: obj.matchInfo?.league?.name || obj.leagueInfo?.name || null,
    homeName: obj.matchInfo?.homeTeam?.name || null,
    awayName: obj.matchInfo?.awayTeam?.name || null,
  };
}

// ─── GET / ── list across collections ─────────────────────────────────────

/**
 * Query params:
 *   collection  one of: article|soi-keo|auto|all    (default all)
 *   reviewed    pending|content|image|done|all      (default all)
 *   q           search by title substring (case-insensitive)
 *   limit       default 50, max 200
 *   page        default 1
 */
router.get('/', async (req, res) => {
  try {
    const collection = req.query.collection || 'all';
    const reviewed = req.query.reviewed || 'all';
    const q = (req.query.q || '').trim();
    const limit = Math.min(200, parseInt(req.query.limit, 10) || 50);
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const skip = (page - 1) * limit;

    const keys = collection === 'all' ? Object.keys(COLLECTIONS) : [collection];
    if (keys.some((k) => !COLLECTIONS[k])) {
      return res.status(400).json({ success: false, error: 'invalid collection' });
    }

    // Use { $ne: true } instead of { $eq: false } so documents created before
    // these fields existed on the schema (still `undefined` in Mongo) are
    // counted as "not reviewed". A bare `false` equality filter would miss
    // them entirely.
    const UNREVIEWED = { $ne: true };
    const reviewFilter = {};
    if (reviewed === 'pending') { reviewFilter.contentReviewed = UNREVIEWED; reviewFilter.imageReviewed = UNREVIEWED; }
    else if (reviewed === 'content') { reviewFilter.contentReviewed = true; reviewFilter.imageReviewed = UNREVIEWED; }
    else if (reviewed === 'image') { reviewFilter.imageReviewed = true; reviewFilter.contentReviewed = UNREVIEWED; }
    else if (reviewed === 'done') { reviewFilter.contentReviewed = true; reviewFilter.imageReviewed = true; }

    const textFilter = q ? { title: { $regex: q, $options: 'i' } } : {};

    const results = await Promise.all(keys.map(async (key) => {
      const { model } = COLLECTIONS[key];
      const filter = { ...reviewFilter, ...textFilter };
      const [rows, total] = await Promise.all([
        model.find(filter).sort({ createdAt: -1 }).limit(limit + skip).lean(),
        model.countDocuments(filter),
      ]);
      return { key, rows, total };
    }));

    // Merge and sort globally by createdAt desc, then paginate.
    const merged = [];
    for (const r of results) for (const row of r.rows) merged.push(shapeListRow(row, r.key));
    merged.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    const totalAll = results.reduce((s, r) => s + r.total, 0);
    const paged = merged.slice(skip, skip + limit);

    // Per-collection counts for the sidebar filter UI.
    const byCollection = {};
    for (const r of results) byCollection[r.key] = r.total;

    res.json({
      success: true,
      data: paged,
      pagination: { page, limit, total: totalAll },
      byCollection,
    });
  } catch (err) {
    console.error('[admin/articles list] error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── GET /:collection/:id ── fetch one for edit ───────────────────────────

router.get('/:collection/:id', async (req, res) => {
  try {
    const cfg = cfgFor(req.params.collection);
    if (!cfg) return res.status(404).json({ success: false, error: 'unknown collection' });
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, error: 'invalid id' });
    }
    const doc = await cfg.model.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ success: false, error: 'not found' });
    res.json({ success: true, data: { ...doc, collection: req.params.collection } });
  } catch (err) {
    console.error('[admin/articles get] error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── PATCH /:collection/:id ── update whitelisted fields ──────────────────

router.patch('/:collection/:id', async (req, res) => {
  try {
    const cfg = cfgFor(req.params.collection);
    if (!cfg) return res.status(404).json({ success: false, error: 'unknown collection' });
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, error: 'invalid id' });
    }

    const update = {};
    for (const key of cfg.patchable) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        update[key] = req.body[key];
      }
    }

    // Stamp reviewedAt whenever either flag flips. Cheap enough to always set.
    if (update.contentReviewed || update.imageReviewed) {
      update.reviewedAt = new Date();
    }

    const doc = await cfg.model.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!doc) return res.status(404).json({ success: false, error: 'not found' });

    // SoiKeoArticle has nested content object — mark modified so Mongoose persists
    // changes inside subdocuments when the client patches content as an object.
    if (req.params.collection === 'soi-keo' && update.content && typeof update.content === 'object') {
      doc.markModified('content');
      await doc.save();
    }

    res.json({ success: true, data: doc });
  } catch (err) {
    console.error('[admin/articles patch] error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ─── POST /:collection/:id/image ── upload hero image ─────────────────────

/**
 * Body: { dataUrl: "data:image/<ext>;base64,<payload>" }
 * Writes to /public/article-images/<id>-admin.<ext>, updates image/thumbnail
 * field + imageReviewed=true.
 */
router.post('/:collection/:id/image', async (req, res) => {
  try {
    const cfg = cfgFor(req.params.collection);
    if (!cfg) return res.status(404).json({ success: false, error: 'unknown collection' });
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, error: 'invalid id' });
    }

    const { dataUrl } = req.body || {};
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      return res.status(400).json({ success: false, error: 'dataUrl must be a data:image/... URL' });
    }

    const match = dataUrl.match(/^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/i);
    if (!match) return res.status(400).json({ success: false, error: 'unsupported image format' });
    const ext = match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
    const buf = Buffer.from(match[2], 'base64');

    // Reject absurdly large uploads. 5MB decoded is plenty for hero images.
    if (buf.length > 5 * 1024 * 1024) {
      return res.status(413).json({ success: false, error: 'image > 5MB' });
    }

    const filename = `${req.params.id}-admin.${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), buf);
    const publicUrl = `/article-images/${filename}`;

    const update = {
      [cfg.imageField]: publicUrl,
      imageReviewed: true,
      reviewedAt: new Date(),
    };
    const doc = await cfg.model.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
    if (!doc) return res.status(404).json({ success: false, error: 'not found' });

    res.json({ success: true, url: publicUrl, data: doc });
  } catch (err) {
    console.error('[admin/articles image] error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
