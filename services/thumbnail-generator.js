/**
 * Thumbnail Generator - Auto-generate match banner images
 *
 * Creates 1200x630 JPG thumbnails for:
 * - Soi-keo articles (home vs away with odds)
 * - H2H articles (home vs away with stats)
 * - Preview articles (league + round)
 *
 * Images saved to /public/thumbnails/ and served as static files
 */

const { createCanvas, loadImage, registerFont } = require('canvas');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

const THUMBNAIL_DIR = process.env.THUMBNAIL_DIR || path.join(__dirname, '..', 'public', 'thumbnails');
const ASSETS_DIR = path.join(__dirname, '..', 'public', 'assets');
const SITE_URL = process.env.SITE_URL || 'https://scoreline.io';
const VS_BG_PATH = path.join(ASSETS_DIR, 'vs-background.jpg');

// Ensure directories exist
if (!fs.existsSync(THUMBNAIL_DIR)) {
  fs.mkdirSync(THUMBNAIL_DIR, { recursive: true });
}
if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

// Cache background image
let vsBgImage = null;
async function getVsBg() {
  if (vsBgImage) return vsBgImage;
  if (fs.existsSync(VS_BG_PATH)) {
    vsBgImage = await loadImage(VS_BG_PATH);
    return vsBgImage;
  }
  return null;
}

// Cache downloaded images to avoid re-downloading
const imageCache = new Map();

async function downloadImage(url) {
  if (!url) return null;
  if (imageCache.has(url)) return imageCache.get(url);

  try {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 8000,
    });
    const img = await loadImage(Buffer.from(response.data));
    imageCache.set(url, img);
    return img;
  } catch (e) {
    console.error(`[Thumbnail] Failed to download: ${url}`);
    return null;
  }
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawFieldPattern(ctx, w, h) {
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;

  // Center circle
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 80, 0, Math.PI * 2);
  ctx.stroke();

  // Center line
  ctx.beginPath();
  ctx.moveTo(w / 2, 0);
  ctx.lineTo(w / 2, h);
  ctx.stroke();

  // Penalty areas
  ctx.strokeRect(0, h / 2 - 100, 120, 200);
  ctx.strokeRect(w - 120, h / 2 - 100, 120, 200);
}

function drawLogo(ctx, img, x, y, size) {
  if (!img) {
    // Placeholder circle
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 2;
    ctx.stroke();
    return;
  }

  // Draw with circular clip
  ctx.save();
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2, size / 2 + 4, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fill();
  ctx.restore();

  // Draw image
  ctx.drawImage(img, x, y, size, size);
}

function truncateText(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (ctx.measureText(t + '...').width > maxWidth && t.length > 0) {
    t = t.slice(0, -1);
  }
  return t + '...';
}

/**
 * Generate match thumbnail (soi-keo / h2h)
 */
async function generateMatchThumbnail({
  homeTeamName,
  homeTeamLogo,
  awayTeamName,
  awayTeamLogo,
  leagueName,
  leagueLogo,
  matchDate,
  type = 'match', // 'match' | 'h2h'
  subtitle = '',
  filename,
}) {
  const W = 1200;
  const H = 630;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Try to load VS background image
  const bgImage = await getVsBg();

  if (bgImage) {
    // Draw background image, cover the canvas
    const scale = Math.max(W / bgImage.width, H / bgImage.height);
    const bw = bgImage.width * scale;
    const bh = bgImage.height * scale;
    ctx.drawImage(bgImage, (W - bw) / 2, (H - bh) / 2, bw, bh);

    // Darken overlay for readability
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, 0, W, H);
  } else {
    // Fallback gradient
    const bgGrad = ctx.createLinearGradient(0, 0, W, H);
    bgGrad.addColorStop(0, '#0a0e27');
    bgGrad.addColorStop(0.4, '#0b1a54');
    bgGrad.addColorStop(0.6, '#3b0a0a');
    bgGrad.addColorStop(1, '#1a0505');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);
    drawFieldPattern(ctx, W, H);
  }

  // Download logos
  const [homeLogo, awayLogo, leagueImg] = await Promise.all([
    downloadImage(homeTeamLogo),
    downloadImage(awayTeamLogo),
    downloadImage(leagueLogo),
  ]);

  // ── Home team logo with glow ring ──
  const homeX = 230, homeY = 180, logoSize = 150;

  // Glow behind logo
  const homeGlow = ctx.createRadialGradient(homeX + logoSize/2, homeY + logoSize/2, 10, homeX + logoSize/2, homeY + logoSize/2, logoSize);
  homeGlow.addColorStop(0, 'rgba(59,130,246,0.5)');
  homeGlow.addColorStop(0.6, 'rgba(59,130,246,0.15)');
  homeGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = homeGlow;
  ctx.fillRect(homeX - 40, homeY - 40, logoSize + 80, logoSize + 80);

  // Ring around logo
  ctx.beginPath();
  ctx.arc(homeX + logoSize/2, homeY + logoSize/2, logoSize/2 + 8, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(59,130,246,0.6)';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Logo
  if (homeLogo) {
    ctx.drawImage(homeLogo, homeX, homeY, logoSize, logoSize);
  }

  // ── Away team logo with glow ring ──
  const awayX = 820, awayY = 180;

  const awayGlow = ctx.createRadialGradient(awayX + logoSize/2, awayY + logoSize/2, 10, awayX + logoSize/2, awayY + logoSize/2, logoSize);
  awayGlow.addColorStop(0, 'rgba(239,68,68,0.5)');
  awayGlow.addColorStop(0.6, 'rgba(239,68,68,0.15)');
  awayGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = awayGlow;
  ctx.fillRect(awayX - 40, awayY - 40, logoSize + 80, logoSize + 80);

  ctx.beginPath();
  ctx.arc(awayX + logoSize/2, awayY + logoSize/2, logoSize/2 + 8, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(239,68,68,0.6)';
  ctx.lineWidth = 3;
  ctx.stroke();

  if (awayLogo) {
    ctx.drawImage(awayLogo, awayX, awayY, logoSize, logoSize);
  }

  // ── Team names ──
  ctx.font = 'bold 30px Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 10;
  const homeText = truncateText(ctx, homeTeamName, 280);
  ctx.fillText(homeText, homeX + logoSize/2, homeY + logoSize + 40);

  const awayText = truncateText(ctx, awayTeamName, 280);
  ctx.fillText(awayText, awayX + logoSize/2, awayY + logoSize + 40);
  ctx.shadowBlur = 0;

  // ── League info bar ──
  drawRoundedRect(ctx, 200, 460, 800, 50, 6);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fill();

  if (leagueImg) {
    ctx.drawImage(leagueImg, 220, 467, 36, 36);
  }

  ctx.font = '18px Arial, sans-serif';
  ctx.fillStyle = '#e2e8f0';
  ctx.textAlign = 'left';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 4;
  ctx.fillText(leagueName || '', leagueImg ? 265 : 220, 492);

  // Match date
  if (matchDate) {
    ctx.textAlign = 'right';
    const d = new Date(matchDate);
    const dateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} - ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    ctx.fillText(dateStr, 980, 492);
  }
  ctx.shadowBlur = 0;

  // ── Type badge ──
  const badgeText = type === 'h2h' ? 'ĐỐI ĐẦU' : 'NHẬN ĐỊNH';
  ctx.font = 'bold 13px Arial, sans-serif';
  ctx.textAlign = 'left';
  const badgeWidth = ctx.measureText(badgeText).width + 24;
  drawRoundedRect(ctx, 30, 30, badgeWidth, 30, 4);
  ctx.fillStyle = type === 'h2h' ? '#ef4444' : '#3b82f6';
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.fillText(badgeText, 42, 51);

  // ── ScoreLine branding ──
  ctx.font = 'bold 18px Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.4)';
  ctx.textAlign = 'right';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 4;
  ctx.fillText('ScoreLine.io', W - 30, H - 20);
  ctx.shadowBlur = 0;

  // Save
  const filePath = path.join(THUMBNAIL_DIR, filename);
  const buffer = canvas.toBuffer('image/jpeg', { quality: 0.85 });
  fs.writeFileSync(filePath, buffer);

  console.log(`[Thumbnail] Generated: ${filename} (${(buffer.length / 1024).toFixed(0)}KB)`);
  return `/thumbnails/${filename}`;
}

/**
 * Generate league preview thumbnail
 */
async function generatePreviewThumbnail({
  leagueName,
  leagueLogo,
  round,
  season,
  filename,
}) {
  const W = 1200;
  const H = 630;
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');

  // Background
  const bgGrad = ctx.createLinearGradient(0, 0, W, H);
  bgGrad.addColorStop(0, '#0d1f3c');
  bgGrad.addColorStop(1, '#0b1628');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);

  drawFieldPattern(ctx, W, H);

  // Center glow
  const glow = ctx.createRadialGradient(600, 300, 0, 600, 300, 250);
  glow.addColorStop(0, 'rgba(229,181,72,0.12)');
  glow.addColorStop(1, 'transparent');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // League logo
  const leagueImg = await downloadImage(leagueLogo);
  if (leagueImg) {
    ctx.drawImage(leagueImg, 510, 120, 180, 180);
  }

  // League name
  ctx.font = 'bold 42px Arial, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.fillText(leagueName || 'Preview', 600, 360);

  // Round
  ctx.font = 'bold 24px Arial, sans-serif';
  ctx.fillStyle = '#e5b548';
  ctx.fillText(round || '', 600, 400);

  // Season
  ctx.font = '18px Arial, sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`Mùa giải ${season || 2025}/${(season || 2025) + 1}`, 600, 440);

  // Badge
  ctx.font = 'bold 12px Arial, sans-serif';
  ctx.textAlign = 'left';
  const badgeText = 'PREVIEW VÒNG ĐẤU';
  const bw = ctx.measureText(badgeText).width + 20;
  drawRoundedRect(ctx, 40, 40, bw, 28, 4);
  ctx.fillStyle = '#e5b548';
  ctx.fill();
  ctx.fillStyle = '#0b1628';
  ctx.fillText(badgeText, 50, 59);

  // Branding
  ctx.font = 'bold 16px Arial, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.textAlign = 'right';
  ctx.fillText('ScoreLine.io', W - 40, H - 30);

  // Bottom bar
  const bottomGrad = ctx.createLinearGradient(0, H - 4, W, H - 4);
  bottomGrad.addColorStop(0, '#3b82f6');
  bottomGrad.addColorStop(0.5, '#e5b548');
  bottomGrad.addColorStop(1, '#3b82f6');
  ctx.fillStyle = bottomGrad;
  ctx.fillRect(0, H - 4, W, 4);

  const filePath = path.join(THUMBNAIL_DIR, filename);
  const buffer = canvas.toBuffer('image/jpeg', { quality: 0.85 });
  fs.writeFileSync(filePath, buffer);

  console.log(`[Thumbnail] Generated: ${filename} (${(buffer.length / 1024).toFixed(0)}KB)`);
  return `/thumbnails/${filename}`;
}

/**
 * Generate thumbnail for a soi-keo article
 */
async function generateForSoiKeo(article) {
  if (!article?.matchInfo) return null;

  const filename = `${article.slug}.jpg`;
  const filePath = path.join(THUMBNAIL_DIR, filename);

  // Skip if already exists
  if (fs.existsSync(filePath)) return `/thumbnails/${filename}`;

  return generateMatchThumbnail({
    homeTeamName: article.matchInfo.homeTeam?.name || '',
    homeTeamLogo: article.matchInfo.homeTeam?.logo,
    awayTeamName: article.matchInfo.awayTeam?.name || '',
    awayTeamLogo: article.matchInfo.awayTeam?.logo,
    leagueName: article.matchInfo.league?.name || '',
    leagueLogo: article.matchInfo.league?.logo,
    matchDate: article.matchInfo.matchDate,
    type: 'match',
    subtitle: article.title,
    filename,
  });
}

/**
 * Generate thumbnail for an h2h article
 */
async function generateForH2H(article) {
  if (!article?.matchInfo) return null;

  const filename = `${article.slug}.jpg`;
  const filePath = path.join(THUMBNAIL_DIR, filename);

  if (fs.existsSync(filePath)) return `/thumbnails/${filename}`;

  return generateMatchThumbnail({
    homeTeamName: article.matchInfo.homeTeam?.name || '',
    homeTeamLogo: article.matchInfo.homeTeam?.logo,
    awayTeamName: article.matchInfo.awayTeam?.name || '',
    awayTeamLogo: article.matchInfo.awayTeam?.logo,
    leagueName: article.matchInfo.league?.name || '',
    leagueLogo: article.matchInfo.league?.logo,
    matchDate: article.matchInfo.matchDate,
    type: 'h2h',
    subtitle: article.title,
    filename,
  });
}

/**
 * Generate thumbnail for a preview article
 */
async function generateForPreview(article) {
  if (!article?.leagueInfo) return null;

  const filename = `${article.slug}.jpg`;
  const filePath = path.join(THUMBNAIL_DIR, filename);

  if (fs.existsSync(filePath)) return `/thumbnails/${filename}`;

  return generatePreviewThumbnail({
    leagueName: article.leagueInfo.name || '',
    leagueLogo: article.leagueInfo.logo,
    round: article.round || '',
    season: article.seasonYear || 2025,
    filename,
  });
}

module.exports = {
  generateMatchThumbnail,
  generatePreviewThumbnail,
  generateForSoiKeo,
  generateForH2H,
  generateForPreview,
  THUMBNAIL_DIR,
};
