'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function defaultState() {
  return {
    version: 1,
    settings: { mode: 'public' },
    notes: {},
    conversations: {},
    processedMessages: {},
  };
}

function mergeState(value) {
  const base = defaultState();
  if (!value || typeof value !== 'object') return base;
  return {
    version: 1,
    settings: { ...base.settings, ...(value.settings || {}) },
    notes: value.notes && typeof value.notes === 'object' ? value.notes : {},
    conversations: value.conversations && typeof value.conversations === 'object' ? value.conversations : {},
    processedMessages: value.processedMessages && typeof value.processedMessages === 'object' ? value.processedMessages : {},
  };
}

function createStore(filePath) {
  const resolvedPath = path.resolve(filePath);
  const directory = path.dirname(resolvedPath);
  fs.mkdirSync(directory, { recursive: true });

  function read() {
    try {
      if (!fs.existsSync(resolvedPath)) return defaultState();
      return mergeState(JSON.parse(fs.readFileSync(resolvedPath, 'utf8')));
    } catch (error) {
      const wrapped = new Error(`Unable to read state file: ${error.message}`);
      wrapped.cause = error;
      throw wrapped;
    }
  }

  function write(state) {
    const normalized = mergeState(state);
    const tempPath = `${resolvedPath}.${process.pid}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(normalized, null, 2)}\n`, { mode: 0o600 });
    fs.renameSync(tempPath, resolvedPath);
    return normalized;
  }

  function update(mutator) {
    const next = read();
    const result = mutator(next);
    write(next);
    return result;
  }

  function pruneProcessed(now = Date.now()) {
    return update((state) => {
      for (const [id, expiresAt] of Object.entries(state.processedMessages)) {
        if (!Number.isFinite(expiresAt) || expiresAt <= now) delete state.processedMessages[id];
      }
      return state.processedMessages;
    });
  }

  function claimMessage(messageId, ttlMs, now = Date.now()) {
    if (!messageId) return true;
    const state = read();
    const currentExpiry = state.processedMessages[messageId];
    if (currentExpiry && currentExpiry > now) return false;
    state.processedMessages[messageId] = now + ttlMs;
    write(state);
    return true;
  }

  function getMode() {
    return read().settings.mode === 'private' ? 'private' : 'public';
  }

  function setMode(mode) {
    if (!['public', 'private'].includes(mode)) throw new Error('Mode must be public or private');
    return update((state) => {
      state.settings.mode = mode;
      return mode;
    });
  }

  function clearConversation(chatId) {
    return update((state) => {
      delete state.conversations[chatId];
      return true;
    });
  }

  function getConversation(chatId, maxMessages) {
    const messages = read().conversations[chatId];
    if (!Array.isArray(messages)) return [];
    return messages.slice(-maxMessages);
  }

  function appendConversation(chatId, messages, maxMessages) {
    return update((state) => {
      const existing = Array.isArray(state.conversations[chatId]) ? state.conversations[chatId] : [];
      state.conversations[chatId] = [...existing, ...messages].slice(-maxMessages);
      return state.conversations[chatId];
    });
  }

  function addNote(ownerId, text, maxNotes) {
    return update((state) => {
      const notes = Array.isArray(state.notes[ownerId]) ? state.notes[ownerId] : [];
      const note = { id: crypto.randomUUID(), text, createdAt: new Date().toISOString() };
      state.notes[ownerId] = [...notes, note].slice(-maxNotes);
      return note;
    });
  }

  function getNotes(ownerId) {
    const notes = read().notes[ownerId];
    return Array.isArray(notes) ? notes : [];
  }

  return Object.freeze({
    filePath: resolvedPath,
    read,
    write,
    update,
    pruneProcessed,
    claimMessage,
    getMode,
    setMode,
    clearConversation,
    getConversation,
    appendConversation,
    addNote,
    getNotes,
  });
}

module.exports = { createStore, defaultState, mergeState };
