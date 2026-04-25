/**
 * Tiny structured logger.
 *
 * Emits JSON lines so external collectors (PM2 + Loki/Datadog/Sentry's log
 * forwarder, etc.) can parse them. Falls back gracefully if no remote sink
 * is configured — every line still goes to stdout/stderr the same as before,
 * just with consistent shape and timestamps.
 *
 * Optional: set SENTRY_DSN to forward `error` calls to Sentry. The require is
 * deferred so the dependency is optional.
 */

let sentry = null;
if (process.env.SENTRY_DSN) {
  try {
    sentry = require('@sentry/node');
    sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'production',
      tracesSampleRate: 0,
    });
  } catch (e) {
    // @sentry/node not installed — silently skip remote forwarding.
    sentry = null;
  }
}

function emit(stream, level, scope, message, meta) {
  const line = {
    ts: new Date().toISOString(),
    level,
    scope,
    msg: message,
  };
  if (meta && typeof meta === 'object') {
    if (meta instanceof Error) {
      line.error = { name: meta.name, message: meta.message, stack: meta.stack };
    } else {
      Object.assign(line, meta);
    }
  }
  try {
    stream.write(JSON.stringify(line) + '\n');
  } catch (e) {
    // Last-resort fallback if JSON.stringify trips on a circular value.
    stream.write(`[${line.ts}] ${level} ${scope} ${message}\n`);
  }
}

function child(scope) {
  return {
    info: (message, meta) => emit(process.stdout, 'info', scope, message, meta),
    warn: (message, meta) => emit(process.stderr, 'warn', scope, message, meta),
    error: (message, meta) => {
      emit(process.stderr, 'error', scope, message, meta);
      if (sentry) {
        const err = meta instanceof Error ? meta : new Error(message);
        sentry.captureException(err, { tags: { scope } });
      }
    },
  };
}

module.exports = { child };
