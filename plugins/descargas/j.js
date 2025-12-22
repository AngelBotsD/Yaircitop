import axios from "axios"
import yts from "yt-search"

const API_BASE = (global.APIs.may || "").replace(/\/+$/, "")
const API_KEY  = global.APIKeys.may || ""

// Función para manejar botones de YouTube
async function handleYTButton(conn, m, id) {
  try {
    if (!id) return

    const [type, url, title] = id.split("|")
    if (!url) return

    await conn.sendMessage(m.chat, { react: { text: "🕒", key: m.key } })

    if (type === "yt_audio") {
      const { data } = await axios.get(`${API_BASE}/ytdl?url=${encodeURIComponent(url)}&type=Mp3&apikey=${API_KEY}`)
      if (!data?.status) throw "No se pudo obtener el audio"
      await conn.sendMessage(m.chat, {
        audio: { url: data.result.url },
        mimetype: "audio/mpeg",
        fileName: `${title}.mp3`
      }, { quoted: m })
    }

    if (type === "yt_video") {
      const { data } = await axios.get(`${API_BASE}/ytdl?url=${encodeURIComponent(url)}&type=Mp4&apikey=${API_KEY}`)
      if (!data?.status) throw "No se pudo obtener el video"
      await conn.sendMessage(m.chat, {
        video: { url: data.result.url },
        mimetype: "video/mp4",
        fileName: `${title}.mp4`
      }, { quoted: m })
    }

    await conn.sendMessage(m.chat, { react: { text: "✅", key: m.key } })

  } catch (e) {
    console.error("Error al manejar botón YT:", e)
    await conn.sendMessage(m.chat, { text: `❌ Error: ${e}` }, { quoted: m })
  }
}

// Comando principal .play
const handler = async (msg, { conn, text, usedPrefix, command }) => {
  const chatId = msg.key.remoteJid
  const query = String(text || "").trim()

  if (!query) {
    return conn.sendMessage(chatId, {
      text: `✳️ Usa:\n${usedPrefix}${command} <nombre de canción>\nEj:\n${usedPrefix}${command} Lemon Tree`
    }, { quoted: msg })
  }

  await conn.sendMessage(chatId, { react: { text: "🕒", key: msg.key } })

  try {
    // Buscar en YouTube
    const search = await yts(query)
    if (!search?.videos?.length) throw "No se encontró ningún resultado"

    const video = search.videos[0]
    const title = video.title
    const author = video.author?.name || "Desconocido"
    const duration = video.timestamp || "Desconocida"
    const thumb = video.thumbnail
    const videoUrl = video.url

    // Miniatura + botones
    const caption =
`> *𝚈𝚃 𝙿𝙻𝙰𝗬*

⭒ 🎵 *𝚃ítulo:* ${title}
⭒ 🎤 *𝙰𝗋𝚝𝗂𝗌𝗍𝗮:* ${author}
⭒ 🕑 *𝙳𝚞𝗋𝗮𝗖ión:* ${duration}

Selecciona el formato 👇

> \`\`\`© Powered by Angel.xyz\`\`\`
`

    await conn.sendMessage(chatId, {
      image: { url: thumb },
      caption,
      buttons: [
        { buttonId: `yt_audio|${videoUrl}|${title}`, buttonText: { displayText: "🎧 Audio" }, type: 1 },
        { buttonId: `yt_video|${videoUrl}|${title}`, buttonText: { displayText: "🎬 Video" }, type: 1 }
      ],
      headerType: 4
    }, { quoted: msg })

    await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } })

  } catch (e) {
    console.error(e)
    conn.sendMessage(chatId, { text: `❌ Error: ${e}` }, { quoted: msg })
  }
}

handler.command = ["playa"]
handler.tags = ["descargas"]
handler.help = ["play <texto>"]

// Exportamos todo junto
export { handler as default, handleYTButton }