import axios from "axios"
import yts from "yt-search"

const API_BASE = (global.APIs.may || "").replace(/\/+$/, "")
const API_KEY  = global.APIKeys.may || ""

const handler = async (msg, { conn, text, usedPrefix, command }) => {
  const chatId = msg.key.remoteJid
  if (!text) return conn.sendMessage(chatId, {
    text: `✳️ Usa:\n${usedPrefix}${command} <nombre de canción o texto>\nEj:\n${usedPrefix}${command} Lemon Tree`
  }, { quoted: msg })

  await conn.sendMessage(chatId, { react: { text: "🕒", key: msg.key } })

  let title = "Desconocido"
  let author = "Desconocido"
  let duration = "Desconocida"
  let videoUrl = null
  let quality = "128kbps"

  try {
    const search = await yts(text)
    if (!search?.videos?.length) throw new Error("No se encontró ningún resultado")
    const video = search.videos[0]
    title = video.title || title
    author = video.author?.name || author
    duration = video.timestamp || duration
    const videoLink = video.url

    const { data } = await axios.get(`${API_BASE}/ytdl?url=${encodeURIComponent(videoLink)}&type=Mp3&apikey=${API_KEY}`)
    if (!data?.status || !data.result?.url) throw new Error(data?.message || "No se pudo obtener el audio")
    videoUrl = data.result.url

    const caption = `
> *𝚈𝚃 𝗣𝗟𝗔𝗬 𝗗𝗢𝗪𝗡𝗟𝗢𝗔𝗗𝗘𝗥*

⭒ ִֶָ७ ꯭🎵˙⋆｡ - *𝚃𝚒́𝚝𝚞𝗅𝗈:* ${title}
⭒ ִֶָ७ ꯭🎤˙⋆｡ - *𝙰𝗋𝗍𝗂𝗌𝗍𝗮:* ${author}
⭒ ִֶָ७ ꯭🕑˙⋆｡ - *𝙳𝚞𝗋𝗮𝗖𝗂ó𝗇:* ${duration}
⭒ ִֶָ७ ꯭📺˙⋆｡ - *𝙲𝚊𝗅𝗂𝗱𝗮𝗱:* ${quality}
⭒ ִֶָ७ ꯭🌐˙⋆｡ - *𝙰𝗉𝗂:* MayAPI

» 𝘼𝗨𝗗𝗜𝗢 𝙴𝗡𝗩𝗜𝗔𝗗𝗢 🎧  
» 𝘿𝗜𝗦𝗙𝗥𝗨𝗧𝗔𝗟𝗢 𝘾𝗔𝗠𝗣𝗘𝗢𝗡..

⇆‌ ㅤ◁ㅤㅤ❚❚ㅤㅤ▷ㅤ↻

> \`\`\`© 𝖯𝗈𝗐𝖾𝗋𝗲𝖽 𝖻𝗒 𝖠𝗇𝗀𝖾𝗅.𝗑𝗒𝗓\`\`\``

    await conn.sendMessage(chatId, { react: { text: "🕒", key: msg.key } })
    await conn.sendMessage(chatId, { text: caption, quoted: msg })
    await conn.sendMessage(chatId, {
      audio: { url: videoUrl },
      mimetype: "audio/mpeg",
      fileName: `${title}.mp3`,
      ptt: false
    }, { quoted: msg })

    await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } })

  } catch (err) {
    console.error("play error:", err)
    await conn.sendMessage(chatId, {
      text: `❌ Error: ${err?.message || "Fallo interno"}`
    }, { quoted: msg })
  }
}

handler.command = ["play", "ytplay"]
handler.help = ["play <texto>"]
handler.tags = ["descargas"]

export default handler