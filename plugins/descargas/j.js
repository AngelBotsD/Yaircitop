import axios from "axios"
import yts from "yt-search"

const API_BASE = (global.APIs.may || "").replace(/\/+$/, "")
const API_KEY  = global.APIKeys.may || ""

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
    // 1️⃣ Buscar en YouTube
    const search = await yts(query)
    if (!search?.videos?.length) throw "No se encontró ningún resultado"

    const video = search.videos[0]
    const title = video.title
    const author = video.author?.name || "Desconocido"
    const duration = video.timestamp || "Desconocida"
    const thumb = video.thumbnail
    const videoUrl = video.url

    // 2️⃣ Preparar miniatura + botones
    const caption =
`> *𝚈𝚃 𝙿𝙻𝙰𝗬*

⭒ 🎵 *𝚃ítulo:* ${title}
⭒ 🎤 *𝙰𝗋𝚝𝗂𝗌𝚝𝗮:* ${author}
⭒ 🕑 *𝙳𝚞𝗋𝗮𝗰ión:* ${duration}

Selecciona el formato 👇

> \`\`\`© Powered by Angel.xyz\`\`\`
`

    await conn.sendMessage(chatId, {
      image: { url: thumb },
      caption,
      buttons: [
        { buttonId: "audio", buttonText: { displayText: "🎧 Audio" }, type: 1 },
        { buttonId: "video", buttonText: { displayText: "🎬 Video" }, type: 1 }
      ],
      headerType: 4
    }, { quoted: msg })

    // 3️⃣ Esperar interacción del botón
    conn.on('message.upsert', async (m) => {
      const msgUp = m.messages?.[0]
      if (!msgUp || !msgUp.key.fromMe) return

      const selected = msgUp.message?.buttonsResponseMessage?.selectedButtonId
      if (!selected) return

      if (selected === "audio") {
        const { data } = await axios.get(`${API_BASE}/ytdl?url=${encodeURIComponent(videoUrl)}&type=Mp3&apikey=${API_KEY}`)
        if (!data?.status) throw "No se pudo obtener el audio"
        await conn.sendMessage(chatId, { 
          audio: { url: data.result.url },
          mimetype: "audio/mpeg",
          fileName: `${title}.mp3`
        }, { quoted: msg })
      }

      if (selected === "video") {
        const { data } = await axios.get(`${API_BASE}/ytdl?url=${encodeURIComponent(videoUrl)}&type=Mp4&apikey=${API_KEY}`)
        if (!data?.status) throw "No se pudo obtener el video"
        await conn.sendMessage(chatId, { 
          video: { url: data.result.url },
          mimetype: "video/mp4",
          fileName: `${title}.mp4`
        }, { quoted: msg })
      }
    })

    await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } })

  } catch (e) {
    console.error(e)
    conn.sendMessage(chatId, { text: `❌ Error: ${e}` }, { quoted: msg })
  }
}

handler.command = ["playa"]
handler.tags = ["descargas"]
handler.help = ["play <texto>"]

export default handler