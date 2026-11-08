const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const axios = require('axios');

function looksLikeMedia(buf) {
  if (!buf || buf.length < 16) return false;
  if (buf.slice(4, 8).toString('ascii') === 'ftyp') return true;
  return buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3;
}

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const child = spawn('ffmpeg', args, { windowsHide: true });
    let err = '';
    child.stderr.on('data', (chunk) => {
      err += chunk.toString();
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(err.trim().split('\n').slice(-2).join(' ') || `ffmpeg exited ${code}`));
    });
  });
}

function inspectMedia(file) {
  return new Promise((resolve) => {
    const child = spawn('ffmpeg', ['-hide_banner', '-i', file], { windowsHide: true });
    let err = '';
    child.stderr.on('data', (chunk) => {
      err += chunk.toString();
    });
    child.on('close', () => {
      const video = /Stream #\d+:\d+.*Video:\s*([a-z0-9]+)/i.exec(err)?.[1]?.toLowerCase() || '';
      const audio = /Stream #\d+:\d+.*Audio:\s*([a-z0-9]+)/i.exec(err)?.[1]?.toLowerCase() || '';
      const size = /Video:.*?(\d{2,5})x(\d{2,5})/i.exec(err);
      resolve({ video, audio, height: size ? Number(size[2]) : 0 });
    });
  });
}

async function toWhatsAppMp4(input, output) {
  const info = await inspectMedia(input);
  const h264 = info.video === 'h264';
  const aac = !info.audio || info.audio === 'aac';

  if (h264 && aac) {
    await runFfmpeg(['-y', '-i', input, '-c', 'copy', '-movflags', '+faststart', output]);
    return;
  }

  const args = ['-y', '-i', input];
  if (!h264) {
    args.push('-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '26', '-pix_fmt', 'yuv420p');
    if (info.height > 720) args.push('-vf', 'scale=-2:720');
  } else {
    args.push('-c:v', 'copy');
  }
  if (info.audio && !aac) args.push('-c:a', 'aac', '-b:a', '128k');
  else if (info.audio) args.push('-c:a', 'copy');
  else args.push('-an');
  args.push('-movflags', '+faststart', output);
  await runFfmpeg(args);
}

/**
 * Download a video URL, remux/convert for WhatsApp, return MP4 buffer.
 */
async function fetchWhatsAppVideo(videoUrl, headers = {}) {
  const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const input = path.join(os.tmpdir(), `wa-${stamp}.mp4`);
  const output = path.join(os.tmpdir(), `wa-${stamp}-out.mp4`);

  try {
    const { data, status, headers: resHeaders } = await axios.get(videoUrl, {
      responseType: 'arraybuffer',
      timeout: 180000,
      maxContentLength: 100 * 1024 * 1024,
      maxBodyLength: 100 * 1024 * 1024,
      maxRedirects: 5,
      validateStatus: (s) => s >= 200 && s < 400,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'video/mp4,video/*,*/*;q=0.9,*/*;q=0.8',
        'Accept-Encoding': 'identity',
        ...headers,
      },
    });
    const source = Buffer.from(data);
    const ctype = String(resHeaders['content-type'] || '');
    if (!looksLikeMedia(source)) {
      const head = source.slice(0, 80).toString('utf8').replace(/\s+/g, ' ');
      throw new Error(
        `Download was not a video file (HTTP ${status}, ${ctype || 'unknown'}, ${source.length}b): ${head}`
      );
    }

    fs.writeFileSync(input, source);
    await toWhatsAppMp4(input, output);
    const video = fs.readFileSync(output);
    if (!looksLikeMedia(video)) throw new Error('Converted file is not a video');
    return video;
  } finally {
    for (const file of [input, output]) {
      try {
        if (fs.existsSync(file)) fs.unlinkSync(file);
      } catch {}
    }
  }
}

async function downloadBuffer(url, headers = {}) {
  const { data } = await axios.get(url, {
    responseType: 'arraybuffer',
    timeout: 60000,
    maxRedirects: 5,
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Encoding': 'identity',
      ...headers,
    },
  });
  return Buffer.from(data);
}

/**
 * Build a WhatsApp MP4 from TikTok photo-mode images (+ optional audio).
 * TikTok plays these as video; CDN only gives stills + mp3.
 */
async function slideshowToWhatsAppVideo(imageUrls, audioUrl = null, headers = {}) {
  if (!imageUrls?.length) throw new Error('No images for slideshow');

  const stamp = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const dir = path.join(os.tmpdir(), `ttslide-${stamp}`);
  const output = path.join(os.tmpdir(), `ttslide-${stamp}.mp4`);
  const files = [];

  try {
    fs.mkdirSync(dir, { recursive: true });

    for (let i = 0; i < imageUrls.length; i++) {
      const buf = await downloadBuffer(imageUrls[i], headers);
      const imgPath = path.join(dir, `img-${i}.jpg`);
      fs.writeFileSync(imgPath, buf);
      files.push(imgPath);
    }

    let audioPath = null;
    if (audioUrl) {
      try {
        const abuf = await downloadBuffer(audioUrl, headers);
        audioPath = path.join(dir, 'audio.mp3');
        fs.writeFileSync(audioPath, abuf);
      } catch {
        audioPath = null;
      }
    }

    const perImage = audioPath ? Math.max(2, 3) : 3;
    // Single image: loop still + audio (TikTok photo post)
    if (files.length === 1) {
      const args = ['-y', '-loop', '1', '-i', files[0]];
      if (audioPath) args.push('-i', audioPath);
      args.push(
        '-c:v', 'libx264',
        '-tune', 'stillimage',
        '-pix_fmt', 'yuv420p',
        '-vf', 'scale=720:-2:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2',
        '-r', '30'
      );
      if (audioPath) {
        args.push('-c:a', 'aac', '-b:a', '128k', '-shortest');
      } else {
        args.push('-t', String(perImage), '-an');
      }
      args.push('-movflags', '+faststart', output);
      await runFfmpeg(args);
    } else {
      // Multi-image slideshow
      const listPath = path.join(dir, 'list.txt');
      const listBody = files
        .map((f) => `file '${f.replace(/\\/g, '/')}'\nduration ${perImage}`)
        .concat(`file '${files[files.length - 1].replace(/\\/g, '/')}'`)
        .join('\n');
      fs.writeFileSync(listPath, listBody);

      const slideOut = path.join(dir, 'slides.mp4');
      await runFfmpeg([
        '-y',
        '-f', 'concat',
        '-safe', '0',
        '-i', listPath,
        '-vf', 'scale=720:-2:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2,format=yuv420p',
        '-r', '30',
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-movflags', '+faststart',
        slideOut,
      ]);

      if (audioPath) {
        await runFfmpeg([
          '-y',
          '-i', slideOut,
          '-i', audioPath,
          '-c:v', 'copy',
          '-c:a', 'aac',
          '-b:a', '128k',
          '-shortest',
          '-movflags', '+faststart',
          output,
        ]);
      } else {
        fs.copyFileSync(slideOut, output);
      }
    }

    const video = fs.readFileSync(output);
    if (!looksLikeMedia(video)) throw new Error('Slideshow render failed');
    return video;
  } finally {
    try {
      if (fs.existsSync(output)) fs.unlinkSync(output);
    } catch {}
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {}
  }
}

module.exports = {
  looksLikeMedia,
  toWhatsAppMp4,
  fetchWhatsAppVideo,
  slideshowToWhatsAppVideo,
};
