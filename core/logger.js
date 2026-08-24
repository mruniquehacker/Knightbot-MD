'use strict';

function createLogger({ logLevel = 'info', logMessageContent = false } = {}, sink = console) {
  const levels = { error: 0, warn: 1, info: 2, debug: 3 };
  const threshold = levels[logLevel] ?? levels.info;
  function emit(level, event, details = {}) {
    if (levels[level] > threshold) return;
    const safe = { event, ...details };
    if (!logMessageContent) {
      delete safe.text;
      delete safe.body;
      delete safe.messageContent;
    }
    const line = JSON.stringify({ timestamp: new Date().toISOString(), level, ...safe });
    (sink[level] || sink.log).call(sink, line);
  }
  return Object.freeze({
    error: (event, details) => emit('error', event, details),
    warn: (event, details) => emit('warn', event, details),
    info: (event, details) => emit('info', event, details),
    debug: (event, details) => emit('debug', event, details),
  });
}

module.exports = { createLogger };
