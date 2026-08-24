'use strict';

const { createConfig } = require('./core/config');

const config = createConfig();
const settings = {
  packname: process.env.STICKER_PACKNAME || config.botName,
  author: process.env.STICKER_AUTHOR || config.botOwner,
  botName: config.botName,
  botOwner: config.botOwner,
  ownerNumber: config.ownerNumber,
  giphyApiKey: process.env.GIPHY_API_KEY || '',
  commandMode: config.commandMode,
  description: 'A personal WhatsApp assistant with configurable commands and AI support.',
  version: '2.0.0',
};

module.exports = settings;
