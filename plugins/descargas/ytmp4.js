import axios from "axios"

const API_BASE = (global.APIs.may || "").replace(/\/+$/, "")
const API_KEY  = global.APIKeys.may || ""

function isYouTube(url = "") {
  return /^https?:\/\//i.test(url) && /(youtube\.com|youtu\.be|music\.youtube\.com)/i.test(url)
}

function fmtDur(sec) {
  const n = Number(sec || 0)
  const h = Math.floor(n / 3600)
  const m = Math.floor((n % 3600) / 60)
  const s = n % 60
  return (h ? `${h}:` : "") + `${m.toString().padStart(2,"0")}:${s.toString().padStart(2,"0")}`
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

  try {
    await conn.sendMessage(chatId, { react: { text: "🕒", key: msg.key } })

    const apiUrl = `${API_BASE}/ytdl?url=${encodeURIComponent(url)}&type=Mp4&apikey=${API_KEY}`
    const { data } = await axios.get(apiUrl)
    if (!data?.status || !data.result?.url) throw new Error(data?.message || "No se pudo obtener el video")

    const videoUrl = data.result.url
    const title = data.result.title || "YouTube"
    const durTxt = data.result.duration ? fmtDur(data.result.duration) : "—"

    await conn.sendMessage(chatId, {
      video: { url: videoUrl },
      mimetype: "video/mp4",
      caption: `> *𝚈𝚃𝙼𝙿4 𝙳𝙾𝚆𝙽𝙻𝙾𝙰𝙳𝙴𝚁*\n\n⭒ ִֶָ७ ꯭🎵˙⋆｡ - *𝚃𝚒́𝚝𝚞𝚕𝚘:* ${title}\n✦ 𝗗𝘂𝗿𝗮𝗰𝗶𝗼́n: ${durTxt}\n⭒ ִֶָ७ ꯭🌐˙⋆｡ - *𝙰𝚙𝚒:* MayAPI`
    }, { quoted: msg })

    await conn.sendMessage(chatId, { react: { text: "✅", key: msg.key } })

  } catch (err) {
    console.error("ytmp4 error:", err)
    await conn.sendMessage(chatId, { text: `❌ Error: ${err?.message || "Fallo interno"}` }, { quoted: msg })
  }
}

handler.command  = ["ytmp4", "yta4"]
handler.help     = ["𝖸𝗍𝗆𝗉4 <𝗎𝗋𝗅>"]
handler.tags     = ["𝖣𝖤𝖲𝖢𝖠𝖱𝖦𝖠𝖲"]

export default handler