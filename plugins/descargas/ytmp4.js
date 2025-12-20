// comandos/ytmp4.mjs — YouTube -> VIDEO (MayAPI, versión ligera)

import axios from "axios";
import fs from "fs";
import path from "path";

const API_BASE = "https://mayapi.ooguy.com";
const API_KEY  = "may-0595dca2";

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

// ==== HANDLER ====
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
    await conn.sendMessage(chatId, { text: "⏳ Descargando video..." }, { quoted: msg });

    // 1) Llamar API
    const apiUrl = `${API_BASE}/ytdl?url=${encodeURIComponent(url)}&type=Mp4&apikey=${API_KEY}`;
    const { data } = await axios.get(apiUrl);
    if (!data?.status || !data.result?.url) throw new Error(data?.message || "No se pudo obtener el video");

    const videoUrl = data.result.url;
    const title = data.result.title || "YouTube";
    const durTxt = data.result.duration ? fmtDur(data.result.duration) : "—";

    // 2) Descargar video temporalmente
    const tmp = ensureTmp();
    const filePath = path.join(tmp, `yt-${Date.now()}-${safeName(title)}.mp4`);

    const writer = fs.createWriteStream(filePath);
    const response = await axios.get(videoUrl, { responseType: "stream" });
    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    // 3) Enviar video
    const buf = fs.readFileSync(filePath);
    await conn.sendMessage(chatId, {
      video: buf,
      mimetype: "video/mp4",
      caption: `⚡ 𝗬𝗼𝘂𝗧𝘂𝗯𝗲 𝗩𝗶𝗱𝗲𝗼 — 𝗟𝗶𝘀𝘁𝗼\n\n✦ 𝗧𝗶́𝘁𝘂𝗹𝗼: ${title}\n✦ 𝗗𝘂𝗿𝗮𝗰𝗶𝗼́n: ${durTxt}\n\n🔗 API usada: ${API_BASE}`
    }, { quoted: msg });

    // 4) Limpiar
    try { fs.unlinkSync(filePath); } catch {}

  } catch (err) {
    console.error("ytmp4 error:", err);
    await conn.sendMessage(chatId, { text: `❌ Error: ${err?.message || "Fallo interno"}` }, { quoted: msg });
  }
}

handler.command  = ["ytmp4","ytv","yt4"];
handler.help     = ["ytmp4 <url>"];
handler.tags     = ["descargas"];
export default handler;