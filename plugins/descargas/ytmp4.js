// comandos/ytmp4.mjs — YouTube -> VIDEO (MayAPI)

import axios from "axios";
import fs from "fs";
import path from "path";
import { promisify } from "util";
import { pipeline } from "stream";

const streamPipe = promisify(pipeline);

// ==== CONFIG API ====
const API_BASE = "https://mayapi.ooguy.com";
const API_KEY  = "may-0595dca2";

// Sin timeout para archivos grandes
axios.defaults.timeout = 0;
axios.defaults.maxBodyLength = Infinity;
axios.defaults.maxContentLength = Infinity;

// ==== HELPERS ====
function isYouTube(url = "") {
  return /^https?:\/\//i.test(url) && /(youtube\.com|youtu\.be|music\.youtube\.com)/i.test(url);
}

function ensureTmp() {
  const tmp = path.resolve("./tmp");
  if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true });
  return tmp;
}

function safeName(name = "video") {
  return String(name)
    .slice(0, 90)
    .replace(/[^\w.\- ]+/g, "_")
    .replace(/\s+/g, " ")
    .trim() || "video";
}

function fmtDur(sec) {
  const n = Number(sec || 0);
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = n % 60;
  return (h ? `${h}:` : "") + `${m.toString().padStart(2,"0")}:${s.toString().padStart(2,"0")}`;
}

async function downloadToFile(url, filePath) {
  const res = await axios.get(url, {
    responseType: "stream",
    headers: {
      "User-Agent": "Mozilla/5.0",
      Accept: "*/*",
    },
    timeout: 0,
    maxRedirects: 5,
    validateStatus: () => true,
  });

  if (res.status >= 400) throw new Error(`HTTP_${res.status}`);

  await streamPipe(res.data, fs.createWriteStream(filePath));
  return filePath;
}

// ==== API MAYAPI ====
async function callMayApi(videoUrl) {
  const endpoint = `${API_BASE}/ytdl?url=${encodeURIComponent(videoUrl)}&apikey=${API_KEY}`;

  const res = await axios.get(endpoint, {
    timeout: 0,
    validateStatus: () => true,
  });

  const data = res.data;
  if (!data?.status) throw new Error(data?.message || "Error en la API");

  const result = data.result || {};
  if (!result.url) throw new Error("API no devolvió URL de video");

  return {
    title: result.title || "YouTube",
    duration: result.duration || 0,
    thumbnail: result.thumbnail || "",
    mediaUrl: result.url,
  };
}

// ==== HANDLER ====
const pendingYTV = {};

export async function handler(msg, { conn, text, usedPrefix, command }) {
  const chatId = msg.key.remoteJid;
  const pref = usedPrefix || ".";

  const url = String(text || "").trim();
  if (!url) {
    return conn.sendMessage(chatId, {
      text: `✳️ Usa:\n${pref}${command} <url>\nEj:\n${pref}${command} https://youtu.be/xxxx`
    }, { quoted: msg });
  }

  if (!isYouTube(url)) {
    return conn.sendMessage(chatId, { text: "❌ URL de YouTube inválida." }, { quoted: msg });
  }

  try {
    await conn.sendMessage(chatId, { react: { text: "⏳", key: msg.key } });
    const waitingMsg = await conn.sendMessage(chatId, { text: "⏳ Espere, descargando su video..." }, { quoted: msg });

    // Guardar trabajo
    pendingYTV[waitingMsg.key.id] = { chatId, url, baseMsg: msg, isBusy: false };

    // Resolver video
    const resolved = await callMayApi(url);
    const title = resolved.title;
    const durTxt = fmtDur(resolved.duration);
    const mediaUrl = resolved.mediaUrl;

    if (!mediaUrl) throw new Error("No se pudo obtener la URL del video.");

    const tmp = ensureTmp();
    const base = safeName(title);
    const filePath = path.join(tmp, `yt-${Date.now()}-${base}.mp4`);

    await downloadToFile(mediaUrl, filePath);

    const caption =
`⚡ 𝗬𝗼𝘂𝗧𝘂𝗯𝗲 𝗩𝗶𝗱𝗲𝗼 — 𝗟𝗶𝘀𝘁𝗼

✦ 𝗧𝗶́𝘁𝘂𝗹𝗼: ${base}
✦ 𝗗𝘂𝗿𝗮𝗰𝗶𝗼́n: ${durTxt}

🔗 𝗔𝗣𝗜 𝘂𝘀𝗮𝗱𝗮: ${API_BASE}`;

    const buf = fs.readFileSync(filePath);

    await conn.sendMessage(chatId, {
      video: buf,
      mimetype: "video/mp4",
      caption,
    }, { quoted: msg });

    try { fs.unlinkSync(filePath); } catch {}
    await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

    delete pendingYTV[waitingMsg.key.id];

  } catch (err) {
    console.error("ytmp4 error:", err);
    await conn.sendMessage(chatId, { text: `❌ Error: ${err?.message || "Fallo interno"}` }, { quoted: msg });
    await conn.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
  }
}

handler.command  = ["ytmp4", "ytv", "yt4"];
handler.help     = ["ytmp4 <url>"];
handler.tags     = ["descargas"];
export default handler;