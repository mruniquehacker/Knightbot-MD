// KnightBot-MD - Channel Configuration
// Author: Navida Wijesuriya (RC JESTOR)

const channelInfo = {
  contextInfo: {
    forwardingScore: 999, // This makes forwarded messages look official
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
      // 👇 Your official WhatsApp Channel ID
      newsletterJid: "120363421047540687@newsletter",
      // 👇 Channel name shown in message previews
      newsletterName: "KnightBot MD",
      // Internal message ID (no need to change)
      serverMessageId: -1
    }
  }
};

module.exports = { channelInfo };
