const {
  default: makeWASocket,
  useSingleFileAuthState
} = require("@adiwajshing/baileys");

const { state, saveState } = useSingleFileAuthState("./auth.json");
const sock = makeWASocket({ auth: state });

const antiStatus = {}; // groupJid: true/false

sock.ev.on("messages.upsert", async ({ messages }) => {
  const msg = messages[0];
  if (!msg || !msg.message || msg.key.fromMe) return;

  const groupJid = msg.key.remoteJid;
  if (!groupJid.endsWith("@g.us")) return;

  const text =
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text ||
    "";

  /* =====================
     COMMANDS
  ====================== */
  if (text === ".antistatus on") {
    antiStatus[groupJid] = true;
    return sock.sendMessage(groupJid, {
      text: "🛡️ Anti-Status-Mention ENABLED"
    });
  }

  if (text === ".antistatus off") {
    antiStatus[groupJid] = false;
    return sock.sendMessage(groupJid, {
      text: "❌ Anti-Status-Mention DISABLED"
    });
  }

  if (!antiStatus[groupJid]) return;

  /* =====================
     STATUS-MENTION DETECTION
  ====================== */

  // WhatsApp delivers status mentions as protocol/system messages
  if (
    msg.message.protocolMessage ||
    msg.message.reactionMessage?.key?.remoteJid === "status@broadcast"
  ) {
    try {
      await sock.sendMessage(groupJid, { delete: msg.key });
    } catch (e) {
      console.log("Failed to delete status mention");
    }
  }
});

sock.ev.on("creds.update", saveState);
console.log("✅ Anti-Status-Mention running");
