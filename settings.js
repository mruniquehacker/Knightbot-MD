require('dotenv').config();

const settings = {
    packname: 'Kartik Editz',
    author: 'Kartik Das',
    botName: "KA-BOT-MD",
    botOwner: 'Kartik Das', // Your name
    ownerNumber: '91xxxxxxxxxx', // Yahan apna WhatsApp number daal dein (Country code ke sath)
    giphyApiKey: 'qnl7ssQChTdPjskTa2Ax2LMaGXz303tq',
    commandMode: "public",
    maxStoreMessages: 20,
    storeWriteInterval: 10000,
    description: "This is a advanced WhatsApp bot managed by Kartik Das.",
    version: "3.0.8",
    updateZipUrl: "https://github.com/mruniquehacker/KnightBot/archive/refs/heads/main.zip",
    // Media / Knight API (song, video, cards, etc.)
    knightApiUrl: process.env.KNIGHT_API_URL || 'https://knight-api.stream',
    knightApiKey: process.env.KNIGHT_API_KEY || 'knight',
    mediaApiUrl: process.env.MEDIA_API_URL || 'https://media-api.stream',
    mediaApiKey: process.env.MEDIA_API_KEY || 'knight',
    princeApiUrl: process.env.PRINCE_API_URL || 'https://prince-api.techn.com',
    princeApiKey: process.env.PRINCE_API_KEY || 'prince'
};

module.exports = settings;
