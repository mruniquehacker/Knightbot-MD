const fetch = require('node-fetch');

async function getLyrics(songTitle) {
    const apis = [
        // Primary API
        `https://lyricsapi.fly.dev/api/lyrics?q=${encodeURIComponent(songTitle)}`,
        // Fallback 1
        `https://api.lyrics.ovh/v1/${encodeURIComponent(songTitle.split('-')[0] || songTitle)}/${encodeURIComponent(songTitle.split('-')[1] || '')}`,
        // Fallback 2
        `https://some-random-api.com/lyrics?title=${encodeURIComponent(songTitle)}`
    ];

    for (const api of apis) {
        try {
            const res = await fetch(api, { timeout: 10000 });
            if (!res.ok) continue;

            const data = await res.json();

            // Handle different API response formats
            if (data?.result?.lyrics) return data.result.lyrics;
            if (data?.lyrics) return data.lyrics;
            if (data?.data?.lyrics) return data.data.lyrics;

        } catch (e) {
            console.log('Lyrics API failed:', api);
        }
    }

    return null;
}

async function lyricsCommand(sock, chatId, songTitle, message) {
    if (!songTitle) {
        return await sock.sendMessage(
            chatId,
            { text: '🔍 Please enter the song name!\nExample: *.lyrics Faded Alan Walker*' },
            { quoted: message }
        );
    }

    try {
        await sock.sendMessage(chatId, { text: '🎵 Searching lyrics...' }, { quoted: message });

        const lyrics = await getLyrics(songTitle);

        if (!lyrics) {
            return await sock.sendMessage(
                chatId,
                { text: `❌ No lyrics found for: *${songTitle}*` },
                { quoted: message }
            );
        }

        // WhatsApp text limit protection
        const maxChars = 4096;
        if (lyrics.length <= maxChars) {
            return await sock.sendMessage(chatId, { text: lyrics }, { quoted: message });
        }

        // Split long lyrics into parts
        for (let i = 0; i < lyrics.length; i += maxChars) {
            const part = lyrics.slice(i, i + maxChars);
            await sock.sendMessage(chatId, { text: part }, { quoted: message });
        }

    } catch (error) {
        console.error('Lyrics Command Error:', error);
        await sock.sendMessage(
            chatId,
            { text: '❌ Error fetching lyrics. Try another song name.' },
            { quoted: message }
        );
    }
}

module.exports = { lyricsCommand };
