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
  } else if (collectionKey === 'article' && obj.category === 'analysis') {
    // Long-form analysis lives at /phan-tich/* (split from the news hub).
    url = obj.slug ? `/phan-tich/${obj.slug}` : '#';
  } else if (collectionKey === 'article' && obj.category === 'transfer') {
    // Transfer news lives at /chuyen-nhuong/* (split from the news hub).
    url = obj.slug ? `/chuyen-nhuong/${obj.slug}` : '#';
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

    // Auto-publish workflow: a fresh auto-generated article sits as 'draft'
    // until a human signs off on BOTH content and image. Once both flags are
    // true we promote it to 'published' (unless the admin explicitly set a
    // different status in the same patch — manual control wins).
    const existing = await cfg.model.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ success: false, error: 'not found' });

    const willContent = Object.prototype.hasOwnProperty.call(update, 'contentReviewed')
      ? !!update.contentReviewed : !!existing.contentReviewed;
    const willImage = Object.prototype.hasOwnProperty.call(update, 'imageReviewed')
      ? !!update.imageReviewed : !!existing.imageReviewed;
    const adminSetStatus = Object.prototype.hasOwnProperty.call(update, 'status');

    if (!adminSetStatus && willContent && willImage && existing.status === 'draft') {
      update.status = 'published';
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

// ─── DELETE /:collection/:id ── permanent delete ──────────────────────────

/**
 * Hard-deletes the article doc and tries to clean up its admin-uploaded
 * hero/stats images. Sitemap cache is invalidated so the now-404 URL
 * doesn't keep getting re-served. Idempotent: 404 if the doc is already
 * gone, never partial state.
 */
router.delete('/:collection/:id', async (req, res) => {
  try {
    const cfg = cfgFor(req.params.collection);
    if (!cfg) return res.status(404).json({ success: false, error: 'unknown collection' });
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, error: 'invalid id' });
    }

    const doc = await cfg.model.findByIdAndDelete(req.params.id);
    if (!doc) return res.status(404).json({ success: false, error: 'not found' });

    // Best-effort cleanup of uploaded files. Each upload writes
    // <id>-admin-<slot>.<ext>; we don't know the extension, so glob the
    // directory and remove anything starting with `<id>-admin-`.
    try {
      const prefix = `${req.params.id}-admin-`;
      for (const name of fs.readdirSync(UPLOAD_DIR)) {
        if (name.startsWith(prefix)) {
          fs.unlinkSync(path.join(UPLOAD_DIR, name));
        }
      }
    } catch (cleanupErr) {
      // Non-fatal — the doc is already gone, orphan files are harmless.
      console.warn('[admin/articles delete] image cleanup failed:', cleanupErr.message);
    }

    // Drop the dynamic sitemap cache so the next bot crawl reflects the
    // removal. invalidateSitemapCache is exported as a named property on
    // the sitemap router module.
    try {
      const sitemap = require('./sitemap');
      if (typeof sitemap.invalidateSitemapCache === 'function') {
        sitemap.invalidateSitemapCache();
      }
    } catch (_) { /* sitemap module not loaded yet — ignore */ }

    res.json({ success: true, deleted: { _id: String(doc._id), title: doc.title } });
  } catch (err) {
    console.error('[admin/articles delete] error:', err);
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

    // slot = 'hero' (default) → top-of-article image, also mirrored into the
    // article.image / .thumbnail field used for OG/SEO.
    // slot = 'stats' → second inline image (the "stats card" the generators
    // inject mid-article). Only updates the markdown — no top-level field.
    const slot = req.body.slot === 'stats' ? 'stats' : 'hero';

    // Bust browser/CDN cache by appending a version suffix each upload.
    const filename = `${req.params.id}-admin-${slot}.${ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, filename), buf);
    const publicUrl = `/article-images/${filename}?v=${Date.now()}`;

    const doc = await cfg.model.findById(req.params.id);
    if (!doc) return res.status(404).json({ success: false, error: 'not found' });

    // Mirror the HERO into the top-level image field; stats slot doesn't
    // have a dedicated field (it only lives inline in content).
    if (slot === 'hero') {
      doc[cfg.imageField] = publicUrl;
    }
    doc.imageReviewed = true;
    doc.reviewedAt = new Date();

    // ─── Rewrite the matching inline image in content ────────────────────

    const altText = doc.title || 'hero image';
    const newMarkdown = `![${altText}](${publicUrl})`;

    /**
     * Replace the Nth `![alt](url)` (0-indexed) in a string, OR prepend the
     * new image when the Nth slot doesn't exist yet. Older articles from
     * before the image-injection feature landed have no inline images, so a
     * plain replace would be a no-op and the upload would appear "lost".
     */
    const upsertNthImage = (text, nth) => {
      if (typeof text !== 'string') return text;
      const count = (text.match(/!\[[^\]]*\]\([^)]+\)/g) || []).length;
      if (count > nth) {
        let seen = 0;
        return text.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt) => {
          const out = seen === nth ? `![${alt || altText}](${publicUrl})` : match;
          seen += 1;
          return out;
        });
      }
      // Slot doesn't exist yet — add the image at the start of this text.
      return `${newMarkdown}\n\n${text}`;
    };

    if (req.params.collection === 'soi-keo') {
      // Soi-keo stores the 2 inline images in DIFFERENT sections:
      //   hero  → content.introduction
      //   stats → content.formAnalysis (fallback: oddsAnalysis)
      if (doc.content && typeof doc.content === 'object') {
        if (slot === 'hero') {
          doc.content.introduction = upsertNthImage(doc.content.introduction || '', 0);
        } else {
          // Pick whichever mid-article section exists; prefer formAnalysis.
          const target = doc.content.formAnalysis ? 'formAnalysis'
            : doc.content.oddsAnalysis ? 'oddsAnalysis'
            : 'formAnalysis'; // fall back by creating the slot
          doc.content[target] = upsertNthImage(doc.content[target] || '', 0);
        }
        doc.markModified('content');
      }
    } else {
      // Article / AutoArticle keep content as a single markdown string, so
      // the 2 inline images are the 1st and 2nd `![](...)` globally.
      if (typeof doc.content === 'string') {
        doc.content = upsertNthImage(doc.content, slot === 'hero' ? 0 : 1);
      } else if (slot === 'hero') {
        // Never happens in practice (content is always a string here) but
        // keep the upload non-fatal if the document is in an unexpected shape.
        doc.content = newMarkdown;
      }
    }

    await doc.save();

    res.json({ success: true, url: publicUrl, slot, data: doc });
  } catch (err) {
    console.error('[admin/articles image] error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
