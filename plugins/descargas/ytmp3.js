"use strict";

import axios from "axios";

const API_BASE = (process.env.API_BASE || "https://api-sky.ultraplus.click").replace(/\/+$/, "");
const API_KEY = process.env.API_KEY || "Russellxz";

const isYouTube = (u = "") =>
  /^(https?:\/\/)?(www\.)?(youtube.com|youtu.be|music.youtube.com)/i.test(String(u || ""));

function safeBaseFromTitle(title) {
  return String(title || "youtube").slice(0, 70).replace(/[^A-Za-z0-9_-.]+/g, "_");
}

async function getYTFromSkyAudio(url) {
  const endpoint = `${API_BASE}/youtube-mp3`;

  const r = await axios.post(
    endpoint,
    { url },
    {
      timeout: 120000,
      headers: {
        "Content-Type": "application/json",
        apikey: API_KEY,
        Accept: "application/json, /",
      },
      validateStatus: () => true,
    }
  );

  const data = typeof r.data === "object" ? r.data : null;
  if (!data) throw new Error("Respuesta no JSON del servidor");

  const ok =
    data.status === true ||
    data.status === "true" ||
    data.ok === true ||
    data.success === true;

  if (!ok) throw new Error(data.message || data.error || "Error en la API");

  const result = data.result || data.data || data;
  const audioSrc = result?.media?.audio;

  if (!audioSrc) throw new Error("No se pudo obtener audio (sin URL).");

  return {
    title: result?.title || "YouTube Audio",
    thumbnail: result?.thumbnail || result?.image || "",
    audio: audioSrc,
  };
}

const handler = async (msg, { conn, args, command }) => {
  const chatId = msg.key.remoteJid;
  const pref = global.prefixes?.[0] || ".";
  let text = (args.join(" ") || "").trim();

  if (!text) {
    return conn.sendMessage(
      chatId,
      { text: `✳️ Usa:\n${pref}${command} <URL YouTube>\nEj: ${pref}${command} https://youtu.be/dQw4w9WgXcQ` },
      { quoted: msg }
    );
  }

  if (!isYouTube(text)) {
    return conn.sendMessage(
      chatId,
      { text: "❌ Enlace inválido. Usa URL de YouTube." },
      { quoted: msg }
    );
  }

  try {
    await conn.sendMessage(chatId, { react: { text: "⏱️", key: msg.key } });

    const d = await getYTFromSkyAudio(text);
    const title = d.title || "YouTube";
    const thumb = d.thumbnail;

    const caption =
`⚡ 𝗬𝗼𝘂𝗧𝘂𝗯𝗲 𝗠𝗣3

🎵 𝗧𝗶́𝘁𝘂𝗹𝗼: ${title}

🤖 𝗕𝗼𝘁: La Suki Bot
🔗 𝗔𝗣𝗜: https://api-sky.ultraplus.click`;

    if (thumb && thumb.startsWith("http")) {
      await conn.sendMessage(chatId, {
        image: { url: thumb },
        caption: caption
      }, { quoted: msg });
    } else {
      await conn.sendMessage(chatId, { text: caption }, { quoted: msg });
    }

    await conn.sendMessage(chatId, { react: { text: "🎵", key: msg.key } });

    await conn.sendMessage(
      chatId,
      {
        audio: { url: d.audio },
        mimetype: "audio/mpeg",
        ptt: false,
        fileName: `${safeBaseFromTitle(title)}.mp3`
      },
      { quoted: msg }
    );

    await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } });

  } catch (err) {
    console.error("❌ Error en ytmp3:", err?.message || err);
    await conn.sendMessage(chatId, { text: `❌ *Error:* ${err?.message || "Fallo al procesar el audio."}` }, { quoted: msg });
    await conn.sendMessage(chatId, { react: { text: "❌", key: msg.key } });
  }
};

handler.command = ["ytmp3", "yta3"];
handler.help = ["𝖸𝗍𝗆𝗉3 <𝗎𝗋𝗅>"];
handler.tags = ["𝖣𝖤𝖲𝖢𝖠𝖱𝖦𝖠𝖲"];

export default handler;