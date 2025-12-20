import fetch from "node-fetch";
import yts from "yt-search";

const ADONIX_API = "https://api-adonix.ultraplus.click";
const API_KEY = "Angxlllll";

// Obtener audio SOLO con Adonix
const getAudioUrl = async (videoUrl) => {
  const url = `${ADONIX_API}/api/ytmp3?url=${encodeURIComponent(videoUrl)}&apikey=${API_KEY}&quality=64`;

  const res = await fetch(url, { timeout: 10_000 });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();

  // Ajusta según la respuesta real de Adonix
  const audioUrl =
    data?.result?.download ||
    data?.result?.url ||
    data?.download ||
    null;

  if (!audioUrl) {
    throw new Error("No se pudo obtener el audio");
  }

  return audioUrl;
};

const handler = async (m, { conn, text, usedPrefix, command }) => {
  if (!text?.trim()) {
    throw `⭐ 𝘌𝘯𝘷𝘪𝘢 𝘦𝘭 𝘯𝘰𝘮𝘣𝘳𝘦 𝘥𝘦 𝘭𝘢 𝘤𝘢𝘯𝘤𝘪ó𝘯\n\n» Ejemplo:\n${usedPrefix + command} Bad Bunny - Monaco`;
  }

  try {
    await conn.sendMessage(m.chat, { react: { text: "🕒", key: m.key } });

    // Buscar video
    const search = await yts({ query: text.trim(), hl: "es", gl: "ES" });
    const video = search.videos?.[0];
    if (!video) throw "❌ No se encontró el video";

    // Límite 10 minutos
    if (video.seconds > 600) {
      throw "❌ El audio es muy largo (máx. 10 minutos)";
    }

    // Info del video
    await conn.sendMessage(m.chat, {
      text: `01:27 ━━━━━⬤────── 05:48
*⇄ㅤ      ◁        ❚❚        ▷        ↻*
╴𝗘𝗹𝗶𝘁𝗲 𝗕𝗼𝘁 𝗚𝗹𝗼𝗯𝗮𝗹`,
      contextInfo: {
        externalAdReply: {
          title: video.title.slice(0, 60),
          body: "",
          thumbnailUrl: video.thumbnail,
          mediaType: 1,
          renderLargerThumbnail: true,
          showAdAttribution: true,
          sourceUrl: video.url
        }
      }
    }, { quoted: m });

    // Obtener audio con Adonix
    const audioUrl = await getAudioUrl(video.url);

    // Enviar audio
    await conn.sendMessage(m.chat, {
      audio: { url: audioUrl },
      mimetype: "audio/mpeg",
      fileName: `${video.title.slice(0, 30)}.mp3`.replace(/[^\w\s.-]/gi, ""),
      ptt: false
    }, { quoted: m });

    await conn.sendMessage(m.chat, { react: { text: "✅", key: m.key } });

  } catch (err) {
    console.error(err);
    await conn.sendMessage(m.chat, { react: { text: "❌", key: m.key } });

    await conn.sendMessage(m.chat, {
      text: typeof err === "string"
        ? err
        : "⚠️ Error al procesar el audio, intenta con otra canción"
    }, { quoted: m });
  }
};

handler.command = ["playaudio"];
handler.exp = 0;
export default handler;