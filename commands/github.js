// commands/.github.js
const moment = require('moment-timezone');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const DEFAULT_REPO = process.env.GITHUB_REPO || 'RC-JESTOR/KNIGHT-BOT-RC-JESTOR';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || null;
const TZ = 'Asia/Colombo';

function humanDuration(seconds) {
  seconds = Math.floor(seconds);
  const days = Math.floor(seconds / 86400);
  seconds -= days * 86400;
  const hours = Math.floor(seconds / 3600);
  seconds -= hours * 3600;
  const minutes = Math.floor(seconds / 60);
  seconds -= minutes * 60;
  const parts = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  if (minutes) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  return parts.join(' ');
}

function getTextFromMessage(message) {
  // Support multiple bailey message shapes gracefully
  try {
    if (!message) return '';
    // For many Baileys versions the text is in message.message.conversation
    if (message.message?.conversation) return message.message.conversation.trim();
    // Or extendedTextMessage
    if (message.message?.extendedTextMessage?.text) return message.message.extendedTextMessage.text.trim();
    // Or message.text (some wrappers)
    if (message.text) return (typeof message.text === 'string' ? message.text : '').trim();
    // Or pushName or caption fallback
    if (message.pushName) return message.pushName.trim();
    return '';
  } catch {
    return '';
  }
}

function buildHeaders() {
  const headers = {
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'KnightBot-GitHub-Info'
  };
  if (GITHUB_TOKEN) headers['Authorization'] = `token ${GITHUB_TOKEN}`;
  return headers;
}

async function fetchJson(url) {
  try {
    const res = await fetch(url, { headers: buildHeaders() });
    if (!res.ok) return { ok: false, status: res.status, json: null };
    const json = await res.json();
    return { ok: true, json, status: res.status, res };
  } catch (err) {
    return { ok: false, status: null, json: null };
  }
}

async function githubCommand(sock, chatId, message) {
  try {
    // Determine repo: priority -> owner/repo in message text -> GITHUB_REPO env -> default
    const text = getTextFromMessage(message);
    const repoMatch = text.match(/([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/);
    const repo = repoMatch ? `${repoMatch[1]}/${repoMatch[2]}` : (process.env.GITHUB_REPO || DEFAULT_REPO);

    // Basic repo fetch
    const repoUrl = `https://api.github.com/repos/${repo}`;
    const repoFetch = await fetchJson(repoUrl);
    if (!repoFetch.ok) {
      await sock.sendMessage(chatId, { text: `❌ Could not fetch repository info for *${repo}*.` }, { quoted: message });
      return;
    }
    const json = repoFetch.json;

    // Try reading package.json for bot version (local)
    let pkg = null;
    try {
      const pkgPath = path.join(__dirname, '..', 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkgRaw = fs.readFileSync(pkgPath, 'utf8');
        pkg = JSON.parse(pkgRaw);
      }
    } catch (e) {
      pkg = null;
    }

    // Build text
    let txt = `*乂  Knight Bot MD  乂*\n\n`;
    txt += `✩ *Name*: ${json.name || repo}\n`;
    // size field is in KB on GitHub API docs, original code divided by 1024 to MB; keep that but guard
    const sizeMB = json.size ? (json.size / 1024).toFixed(2) : 'N/A';
    txt += `✩ *Size*: ${sizeMB} MB\n`;
    // formatted update time and relative
    if (json.updated_at) {
      const formatted = moment(json.updated_at).tz(TZ).format('DD/MM/YY - HH:mm:ss');
      const relative = moment(json.updated_at).fromNow();
      txt += `✩ *Last Updated*: ${formatted} (${relative})\n`;
    } else {
      txt += `✩ *Last Updated*: N/A\n`;
    }
    txt += `✩ *URL*: ${json.html_url}\n`;
    txt += `✩ *Developer*: Navida Wijesuriya\n`;
    txt += `✩ *Features*: Auto-Reply, Group Tools, Fun Commands\n`;
    txt += `✩ *Status*: 🚀 Live and Improving\n\n`;

    // Add stars/forks/watchers
    txt += `✩ *Stars*: ${json.stargazers_count ?? 0}  •  *Forks*: ${json.forks_count ?? 0}  •  *Watchers*: ${json.watchers_count ?? 0}\n`;

    // Bot version & uptime
    if (pkg?.version) txt += `✩ *Bot Version*: v${pkg.version}\n`;
    const uptime = humanDuration(process.uptime());
    txt += `✩ *Uptime*: ${uptime}\n\n`;

    txt += `💥 *KnightBot MD*\n\n✨ *Extra Info* ✨\n`;

    const ownerRepo = json.full_name || repo;

    // fetch parallel endpoints
    const [
      commitData,
      langsData,
      pullsData,
      releaseData,
      contentsData,
      tagsData,
      contribData,
      repoDataFull
    ] = await Promise.all([
      fetchJson(`https://api.github.com/repos/${ownerRepo}/commits?per_page=1`),
      fetchJson(`https://api.github.com/repos/${ownerRepo}/languages`),
      fetchJson(`https://api.github.com/repos/${ownerRepo}/pulls?state=open&per_page=100`),
      fetchJson(`https://api.github.com/repos/${ownerRepo}/releases/latest`),
      fetchJson(`https://api.github.com/repos/${ownerRepo}/contents`),
      fetchJson(`https://api.github.com/repos/${ownerRepo}/tags?per_page=1`),
      fetchJson(`https://api.github.com/repos/${ownerRepo}/contributors?per_page=3`),
      fetchJson(`https://api.github.com/repos/${ownerRepo}`)
    ]);

    // Latest commit
    if (commitData.ok && Array.isArray(commitData.json) && commitData.json.length) {
      const c = commitData.json[0];
      const msg = c.commit?.message?.split('\n')[0] || 'No message';
      const author = c.commit?.author?.name || c.author?.login || 'Unknown';
      const date = c.commit?.author?.date || null;
      const howLong = date ? moment(date).fromNow() : 'unknown time';
      txt += `🔧 Latest commit: "${msg}" — ${author} (${howLong})\n`;
    }

    // Languages breakdown
    if (langsData.ok && langsData.json && Object.keys(langsData.json).length) {
      const langs = langsData.json;
      const total = Object.values(langs).reduce((a, b) => a + b, 0) || 1;
      const topLangs = Object.entries(langs)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([name, bytes]) => `${name} ${(bytes / total * 100).toFixed(0)}%`);
      if (topLangs.length) txt += `🧩 Languages: ${topLangs.join(' • ')}\n`;
    }

    // Open PRs
    if (pullsData.ok) {
      const pulls = pullsData.json;
      txt += `🔁 Open PRs: ${Array.isArray(pulls) ? pulls.length : 0}\n`;
    }

    // Latest release or tag
    let releaseLine = '';
    if (releaseData.ok && releaseData.json?.tag_name) {
      const rel = releaseData.json;
      releaseLine = `🏷️ Latest release: ${rel.tag_name}${rel.name ? ` — ${rel.name}` : ''}`;
    } else if (tagsData.ok && Array.isArray(tagsData.json) && tagsData.json.length) {
      releaseLine = `🏷️ Latest tag: ${tagsData.json[0].name}`;
    }
    if (releaseLine) txt += `${releaseLine}\n`;

    // Repo topics (try repoDataFull)
    try {
      let topics = json.topics || [];
      if ((!topics || !topics.length) && repoDataFull.ok) {
        topics = repoDataFull.json.topics || [];
      }
      if (topics && topics.length) txt += `🏷️ Topics: ${topics.slice(0, 6).join(' · ')}\n`;
    } catch {}

    // Top-level snapshot
    if (contentsData.ok && Array.isArray(contentsData.json)) {
      txt += `📁 Top-level items: ${contentsData.json.length} (files & folders)\n`;
    }

    // Quick tip and commands
    txt += `\n💡 Quick Tip: Clone → \`git clone ${json.html_url}.git\`\n`;
    txt += `🚀 Try commands: .tagall | .tts | .sticker | .welcome\n`;

    // Community mood
    const moods = ['🌟 Open to contributors', '🔥 Active development', '🤝 Welcomes PRs & ideas', '✨ Community-driven'];
    txt += `\n🔔 Community: ${moods[Math.floor(Math.random() * moods.length)]}\n`;

    // Badges (as raw urls - user can copy to README)
    txt += `\n🔗 Badges:\n`;
    txt += `https://img.shields.io/github/v/release/${ownerRepo}?style=for-the-badge\n`;
    txt += `https://img.shields.io/github/license/${ownerRepo}?style=for-the-badge\n`;
    txt += `https://img.shields.io/github/commit-activity/y/${ownerRepo}?style=for-the-badge\n`;

    // Top contributors
    if (contribData.ok && Array.isArray(contribData.json) && contribData.json.length) {
      txt += `\n👥 Top Contributors:\n`;
      contribData.json.forEach((c, i) => {
        txt += `${i + 1}. ${c.login} — ${c.contributions} contribs\n`;
      });
    }

    // Optionally show CI status / actions if available (simple check for .github/workflows)
    try {
      const workflowPath = `https://api.github.com/repos/${ownerRepo}/contents/.github/workflows`;
      const wf = await fetchJson(workflowPath);
      if (wf.ok && Array.isArray(wf.json) && wf.json.length) {
        txt += `\n⚙️ CI Workflows: ${wf.json.length} workflow(s) detected\n`;
      }
    } catch {}

    // Image handling: local asset fallback, otherwise owner avatar
    let imgBuffer = null;
    try {
      const localImage = path.join(__dirname, '../assets/bot_image.jpg');
      if (fs.existsSync(localImage)) {
        imgBuffer = fs.readFileSync(localImage);
      } else if (json.owner?.avatar_url) {
        const avatarRes = await fetch(json.owner.avatar_url);
        if (avatarRes.ok) imgBuffer = await avatarRes.buffer();
      }
    } catch (e) {
      imgBuffer = null;
    }

    // Send message (image with caption when possible)
    if (imgBuffer) {
      await sock.sendMessage(chatId, { image: imgBuffer, caption: txt }, { quoted: message });
    } else {
      await sock.sendMessage(chatId, { text: txt }, { quoted: message });
    }
  } catch (err) {
    console.error('githubCommand error:', err);
    await sock.sendMessage(chatId, { text: '❌ Error fetching repository information.' }, { quoted: message });
  }
}

module.exports = githubCommand;
