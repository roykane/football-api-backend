/**
 * Shared constants for data-derived news generators.
 */

// API-Sports league IDs that get data-derived coverage.
// Kept tight to control LLM cost + relevance to VN audience.
const TARGET_LEAGUES = [
  39,  // Premier League
  140, // La Liga
  135, // Serie A
  78,  // Bundesliga
  61,  // Ligue 1
  2,   // UEFA Champions League
  3,   // UEFA Europa League
  340, // V.League 1 (Vietnam)
];

// Yellow-card threshold that triggers a suspension-watch article.
// API-Sports rules vary per league, but 4 yellows is the canonical
// "next yellow → ban" line in most top leagues.
const SUSPENSION_YELLOW_THRESHOLD = 4;

// Streaks shorter than this are not noteworthy.
const FORM_STREAK_MIN = 5;

// Milestone round numbers to celebrate.
const MILESTONE_APPEARANCES = [50, 100, 150, 200, 250, 300];
const MILESTONE_GOALS = [25, 50, 75, 100, 150, 200];

// Fallback hero images (Unsplash) when no team/player photo is available.
const FALLBACK_IMAGES = [
  'https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=1200&h=630&fit=crop',
  'https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=1200&h=630&fit=crop',
  'https://images.unsplash.com/photo-1560272564-c83b66b1ad12?w=1200&h=630&fit=crop',
];

function pickFallbackImage() {
  return FALLBACK_IMAGES[Math.floor(Math.random() * FALLBACK_IMAGES.length)];
}

function currentSeason() {
  const now = new Date();
  return now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;
}

module.exports = {
  TARGET_LEAGUES,
  SUSPENSION_YELLOW_THRESHOLD,
  FORM_STREAK_MIN,
  MILESTONE_APPEARANCES,
  MILESTONE_GOALS,
  FALLBACK_IMAGES,
  pickFallbackImage,
  currentSeason,
};
