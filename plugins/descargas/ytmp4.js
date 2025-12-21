import axios from "axios"
import yts from "yt-search"

const API_BASE = (global.APIs.may || "").replace(/\/+$/, "")
const API_KEY  = global.APIKeys.may || ""

function isYouTube(url = "") {
  return /^https?:\/\//i.test(url) && /(youtube\.com|youtu\.be|music\.youtube\.com)/i.test(url)
}

const handler = async (msg, { conn, text, usedPrefix, command }) => {
  const chatId = msg.key.remoteJid
  const url = String(text || "").trim()

  if (!url) {
    return conn.sendMessage(chatId, {
      text: `✳️ Usa:\n${usedPrefix}${command} <url>\nEj:\n${usedPrefix}${command} https://youtu.be/xxxx`
    }, { quoted: msg })
  }

  if (!isYouTube(url)) {
    return conn.sendMessage(chatId, { text: "❌ URL de YouTube inválida." }, { quoted: msg })
  }

  await conn.sendMessage(chatId, { react: { text: "🕒", key: msg.key } })

  let title = "Desconocido"
  let author = "Desconocido"
  let duration = "Desconocida"
  let quality = "—"

  try {
    const videoIdMatch = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/))([a-zA-Z0-9_-]{11})/)
    if (videoIdMatch) {
      const videoUrlFull = `https://www.youtube.com/watch?v=${videoIdMatch[1]}`
      const info = await yts({ query: videoUrlFull })
      if (info?.videos?.length > 0) {
        const video = info.videos[0]
        title = video.title || title
        author = video.author?.name || author
        duration = video.timestamp || duration
      }
    }
  } catch {}

  try {
    const { data } = await axios.get(`${API_BASE}/ytdl?url=${encodeURIComponent(url)}&type=Mp4&apikey=${API_KEY}`)
    if (!data?.status || !data.result?.url) throw new Error(data?.message || "No se pudo obtener el video")
    const videoUrl = data.result.url
    quality = data.result.quality || quality

    const caption =
`> *𝚈𝚃𝙼𝙿4 𝙳𝙾𝚆𝙽𝙻𝙾𝙰𝙳𝙴𝚁*

⭒ ִֶָ७ ꯭🎵˙⋆｡ - *𝚃𝚒́𝚝𝚞𝗅𝗈:* ${title}
⭒ ִֶָ७ ꯭🎤˙⋆｡ - *𝙰𝗋𝚝𝗂𝚜𝚝𝗮:* ${author}
⭒ ִֶָ७ ꯭🕑˙⋆｡ - *𝙳𝚞𝗋𝗮𝗖𝗂ó𝗇:* ${duration}
⭒ ִֶָ७ ꯭📺˙⋆｡ - *𝙲𝚊𝗅𝗂𝗱𝗮𝗱:* ${quality}
⭒ ִֶָ७ ꯭🌐˙⋆｡ - *𝙰𝗉𝗂:* MayAPI

» 𝙑𝙄𝘿𝙀𝙊 𝙀𝙉𝙑𝗜𝗔𝗗𝗢 🎧  
» 𝘿𝗜𝙎𝗙𝗥𝗨𝗧𝗔𝗟𝗢 𝘾𝗔𝙈𝗣𝗘𝗢𝗡..

⇆‌ ㅤ◁ㅤㅤ❚❚ㅤㅤ▷ㅤ↻

> \`\`\`© 𝖯𝗈𝗐𝖾𝗋𝗲𝖽 𝖻𝗒 𝖠𝗇𝗀𝖾𝗅.𝗑𝗒𝗓\`\`\``

    await conn.sendMessage(chatId, { video: { url: videoUrl }, mimetype: "video/mp4", caption }, { quoted: msg })
    await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } })

  } catch (err) {
    await conn.sendMessage(chatId, { text: `❌ Error: ${err?.message || "Fallo interno"}` }, { quoted: msg })
  }
}

handler.command = ["ytmp4", "yta4"]
handler.help = ["ytmp4 <url>"]
handler.tags = ["descargas"]

export default handler