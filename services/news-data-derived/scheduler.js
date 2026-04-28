/**
 * Data-Derived News Scheduler
 *
 * Wires 6 trigger generators on cron schedules with a hard daily cap of
 * 15 articles total. Each trigger runs only if cap remaining; receives the
 * remaining slot count so it can self-limit. All articles save as
 * status='draft' for admin review.
 *
 * Kill switch: set ENABLE_DATA_DERIVED_NEWS=true to enable. Default off so
 * deploys don't auto-resume LLM spend without explicit opt-in.
 */

const cron = require('node-cron');
const suspensionWatcher = require('./suspension-watcher');
const injuryTracker = require('./injury-tracker');
const lineupNews = require('./lineup-news');
const formStreakDetector = require('./form-streak-detector');
const milestoneTracker = require('./milestone-tracker');
const topscorerRace = require('./topscorer-race');

const DAILY_CAP = 15;
const TZ = 'Asia/Ho_Chi_Minh';

const dailyCount = { date: '', count: 0 };

function todayKey() {
  return new Date().toLocaleDateString('en-CA', { timeZone: TZ });
}

function slotsRemaining() {
  const today = todayKey();
  if (dailyCount.date !== today) {
    dailyCount.date = today;
    dailyCount.count = 0;
  }
  return Math.max(0, DAILY_CAP - dailyCount.count);
}

function record(n, label) {
  if (!n) return;
  dailyCount.count += n;
  console.log(`📰 [news-derived] ${label} +${n} → daily ${dailyCount.count}/${DAILY_CAP}`);
}

async function safeRun(label, fn, footballApi) {
  const slots = slotsRemaining();
  if (slots <= 0) {
    console.log(`📰 [news-derived] ${label} skipped — daily cap ${DAILY_CAP} reached`);
    return;
  }
  try {
    const created = await fn(footballApi, slots);
    record(created, label);
  } catch (err) {
    console.error(`📰 [news-derived] ${label} crashed:`, err.message);
  }
}

function startDataDerivedNewsScheduler(footballApi) {
  const enabled = process.env.ENABLE_DATA_DERIVED_NEWS === 'true';
  if (!enabled) {
    console.log('📰 [news-derived] DISABLED (set ENABLE_DATA_DERIVED_NEWS=true to enable)');
    return;
  }
  if (!footballApi) {
    console.warn('📰 [news-derived] footballApi missing — scheduler not started');
    return;
  }

  console.log(`📰 [news-derived] STARTED — cap ${DAILY_CAP}/day, 6 triggers, status=draft`);

  // Suspension — daily 09:00 VN
  cron.schedule('0 9 * * *', () => safeRun('suspension', suspensionWatcher.run, footballApi),
    { timezone: TZ });

  // Injury — every 6h (00,06,12,18 VN)
  cron.schedule('0 */6 * * *', () => safeRun('injury', injuryTracker.run, footballApi),
    { timezone: TZ });

  // Lineup — every 30 min, only meaningful 1-2h before kick-off windows
  cron.schedule('*/30 * * * *', () => safeRun('lineup', lineupNews.run, footballApi),
    { timezone: TZ });

  // Form streak — Monday 10:00 VN
  cron.schedule('0 10 * * 1', () => safeRun('form-streak', formStreakDetector.run, footballApi),
    { timezone: TZ });

  // Milestone — Tuesday 10:00 VN
  cron.schedule('0 10 * * 2', () => safeRun('milestone', milestoneTracker.run, footballApi),
    { timezone: TZ });

  // Top-scorer race — Wednesday 10:00 VN
  cron.schedule('0 10 * * 3', () => safeRun('topscorer-race', topscorerRace.run, footballApi),
    { timezone: TZ });
}

module.exports = { startDataDerivedNewsScheduler, DAILY_CAP };
