const moment = require('moment-timezone');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

async function githubCommand(sock, chatId, message) {
  try {
    // Fetch main repository info
    const res = await fetch('https://api.github.com/repos/wijesuriya2017/Knightbot-MD');
    if (!res.ok) throw new Error('Error fetching repository data');
    const json = await res.json();

    // Basic repository info
    let txt = `*乂  Knight Bot MD  乂*\n\n`;
    txt += `✩ *Name*: ${json.name}\n`;
    txt += `✩ *Size*: ${(json.size / 1024).toFixed(2)} MB\n`;
    txt += `✩ *Last Updated*: ${moment(json.updated_at).format('DD/MM/YY - HH:mm:ss')}\n`;
    txt += `✩ *URL*: ${json.html_url}\n`;
    txt += `✩ *Developer*: Navida Wijesuriya\n`;
    txt += `✩ *Features*: Auto-Reply, Group Tools, Fun Commands\n`;
    txt += `✩ *Status*: 🚀 Live and Improving\n\n`;
    txt += `💥 *KnightBot MD*\n\n✨ *Extra Info* ✨\n`;

    const ownerRepo = json.full_name;

    // Fetch extra details in parallel
    const [commitRes, langsRes, pullsRes, releaseRes, contentsRes, repoRes] = await Promise.all([
      fetch(`https://api.github.com/repos/${ownerRepo}/commits?per_page=1`).catch(() => null),
      fetch(`https://api.github.com/repos/${ownerRepo}/languages`).catch(() => null),
      fetch(`https://api.github.com/repos/${ownerRepo}/pulls?state=open&per_page=100`).catch(() => null),
      fetch(`https://api.github.com/repos/${ownerRepo}/releases/latest`).catch(() => null),
      fetch(`https://api.github.com/repos/${ownerRepo}/contents`).catch(() => null),
      fetch(`https://api.github.com/repos/${ownerRepo}`, { headers: { 'Accept': 'application/vnd.github+json' } }).catch(() => null)
    ]);

    // Latest commit
    if (commitRes?.ok) {
      const commits = await commitRes.json();
      if (Array.isArray(commits) && commits.length) {
        const c = commits[0];
        const msg = c.commit?.message.split('\n')[0] || 'No message';
        const author = c.commit?.author?.name || c.author?.login || 'Unknown';
        const date = c.commit?.author?.date || null;
        const howLong = date ? moment(date).fromNow() : 'unknown time';
        txt += `🔧 Latest commit: "${msg}" — ${author} (${howLong})\n`;
      }
    }

    // Languages breakdown
    if (langsRes?.ok) {
      const langs = await langsRes.json();
      const total = Object.values(langs).reduce((a, b) => a + b, 0) || 1;
      const topLangs = Object.entries(langs)
        .sort((a,b) => b[1]-a[1])
        .slice(0,4)
        .map(([name, bytes]) => `${name} ${(bytes/total*100).toFixed(0)}%`);
      if (topLangs.length) txt += `🧩 Languages: ${topLangs.join(' • ')}\n`;
    }

    // Open PRs
    if (pullsRes?.ok) {
      const pulls = await pullsRes.json();
      txt += `🔁 Open PRs: ${Array.isArray(pulls) ? pulls.length : 0}\n`;
    }

    // Latest release or fallback to tag
    let releaseLine = '';
    if (releaseRes?.ok) {
      const rel = await releaseRes.json();
      if (rel?.tag_name) releaseLine = `🏷️ Latest release: ${rel.tag_name} — ${rel.name || ''}`.trim();
    } else {
      try {
        const tagsRes = await fetch(`https://api.github.com/repos/${ownerRepo}/tags?per_page=1`);
        if (tagsRes?.ok) {
          const tags = await tagsRes.json();
          if (Array.isArray(tags) && tags.length) releaseLine = `🏷️ Latest tag: ${tags[0].name}`;
        }
      } catch {}
    }
    if (releaseLine) txt += `${releaseLine}\n`;

    // Repo topics
    try {
      let topics = json.topics || [];
      if (!topics.length && repoRes?.ok) {
        const repoData = await repoRes.json();
        topics = repoData.topics || [];
      }
      if (topics.length) txt += `🏷️ Topics: ${topics.slice(0,6).join(' · ')}\n`;
    } catch {}

    // Root folder snapshot
    if (contentsRes?.ok) {
      const contents = await contentsRes.json();
      txt += `📁 Top-level items: ${Array.isArray(contents) ? contents.length : 0} (files & folders)\n`;
    }

    // Clone hint and bot commands
    txt += `\n💡 Quick Tip: Clone → \`git clone ${json.html_url}.git\`\n`;
    txt += `🚀 Try commands: .tagall | .tts | .sticker | .welcome\n`;

    // Community mood
    const moods = ['🌟 Open to contributors', '🔥 Active development', '🤝 Welcomes PRs & ideas', '✨ Community-driven'];
    txt += `\n🔔 Community: ${moods[Math.floor(Math.random()*moods.length)]}\n`;

    // Badges
    txt += `\n🔗 Badges:\n`;
    txt += `https://img.shields.io/github/v/release/${json.full_name}?style=for-the-badge\n`;
    txt += `https://img.shields.io/github/license/${json.full_name}?style=for-the-badge\n`;
    txt += `https://img.shields.io/github/commit-activity/y/${json.full_name}?style=for-the-badge\n`;

    // Top contributors (optional)
    try {
      const contribRes = await fetch(`https://api.github.com/repos/${json.full_name}/contributors?per_page=3`);
      if (contribRes?.ok) {
        const contributors = await contribRes.json();
        if (Array.isArray(contributors) && contributors.length) {
          txt += `\n👥 Top Contributors:\n`;
          contributors.forEach((c,i) => txt += `${i+1}. ${c.login} — ${c.contributions} contribs\n`);
        }
      }
    } catch {}

    // Image handling (fallback to avatar)
    let imgBuffer;
    try {
      imgBuffer = fs.readFileSync(path.join(__dirname, '../assets/bot_image.jpg'));
    } catch {
      try {
        const avatarRes = await fetch(json.owner.avatar_url);
        imgBuffer = await avatarRes.buffer();
      } catch {
        imgBuffer = null;
      }
    }

    if (imgBuffer) {
      await sock.sendMessage(chatId, { image: imgBuffer, caption: txt }, { quoted: message });
    } else {
      await sock.sendMessage(chatId, { text: txt }, { quoted: message });
    }

  } catch (err) {
    await sock.sendMessage(chatId, { text: '❌ Error fetching repository information.' }, { quoted: message });
  }
}

module.exports = githubCommand;
