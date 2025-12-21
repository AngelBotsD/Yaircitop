import axios from "axios"
import yts from "yt-search"

const API_BASE = (global.APIs.may || "").replace(/\/+$/, "")
const API_KEY  = global.APIKeys.may || ""

const handler = async (msg, { conn, text, usedPrefix, command }) => {
  const chatId = msg.key.remoteJid
  const query = String(text || "").trim()

  if (!query || /^https?:\/\//i.test(query)) {
    return conn.sendMessage(chatId, { 
      text: `✳️ Usa solo texto (no links):\n${usedPrefix}${command} <nombre de canción>\nEj:\n${usedPrefix}${command} Lemon Tree` 
    }, { quoted: msg })
  }

  await conn.sendMessage(chatId, { react: { text: "🕒", key: msg.key } })

  try {
    const search = await yts(query)
    if (!search?.videos?.length) throw new Error("No se encontró ningún resultado")

    const video = search.videos[0]
    const { title = "Desconocido", author, timestamp: duration = "Desconocida", url: videoLink } = video
    const videoAuthor = author?.name || "Desconocido"

    const { data } = await axios.get(`${API_BASE}/ytdl?url=${encodeURIComponent(videoLink)}&type=Mp4&apikey=${API_KEY}`)
    if (!data?.status || !data.result?.url) throw new Error(data?.message || "No se pudo obtener el video")

    const caption =
`> *𝚈𝚃𝗣𝗟𝗔𝗬 𝗩𝗜𝗗𝗘𝗢*

⭒ 🎵 - *𝚃𝚒́𝚝𝚞𝗹𝗼:* ${title}
⭒ 🎤 - *𝙰𝗋𝗍𝗂𝗌𝗍𝗮:* ${videoAuthor}
⭒ 🕑 - *𝙳𝚞𝗋𝗮𝗖𝗂ó𝗇:* ${duration}
⭒ 📺 - *𝙲𝚊𝗹𝗂𝗱𝗮𝗱:* ${data.result.quality || "—"}
⭒ 🌐 - *𝙰𝗉𝗂:* MayAPI

» 𝙑𝙸𝘿𝙀𝙊 𝙴𝗡𝗩𝗜𝗔𝗗𝗢 🎧  
» 𝘿𝗜𝗦𝗙𝗥𝗨𝗧𝗔𝗟𝗢 𝘾𝗔𝙈𝗣𝗘𝗢𝗡..

⇆‌ ㅤ◁ㅤㅤ❚❚ㅤㅤ▷ㅤ↻

> \`\`\`© 𝖯𝗈𝗐𝖾𝗋𝗲𝖽 𝖻𝗒 𝖠𝗇𝗀𝖾𝗅.𝗑𝗒𝗓\`\`\``

    await conn.sendMessage(chatId, { video: { url: data.result.url }, mimetype: "video/mp4", caption }, { quoted: msg })
    await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } })

  } catch (err) {
    console.error("play error:", err)
    await conn.sendMessage(chatId, { text: `❌ Error: ${err?.message || "Fallo interno"}` }, { quoted: msg })
  }
}

handler.command = ["play", "ytplay"]
handler.help    = ["play <texto>"]
handler.tags    = ["descargas"]

export default handler