import axios from "axios"
import yts from "yt-search"
import fs from "fs"
import path from "path"
import { promisify } from "util"
import { pipeline } from "stream"

const streamPipe = promisify(pipeline)
const MAX_FILE_SIZE = 60 * 1024 * 1024

const handler = async (msg, { conn, text }) => {
  if (!text || !text.trim()) {
    return conn.sendMessage(
      msg.key.remoteJid,
      { text: "🎶 Ingresa un enlace de YouTube válido" },
      { quoted: msg }
    )
  }

  const videoMatch = text.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|live\/|v\/))([a-zA-Z0-9_-]{11})/)
  if (!videoMatch) {
    return conn.sendMessage(
      msg.key.remoteJid,
      { text: "❌ Solo se permite un enlace de YouTube válido." },
      { quoted: msg }
    )
  }

  const videoUrl = `https://www.youtube.com/watch?v=${videoMatch[1]}`
  await conn.sendMessage(msg.key.remoteJid, { react: { text: "🕒", key: msg.key } })

  // Obtener info del video con yts
  let title = "Desconocido"
  let artista = "Desconocido"
  let duration = "?"
  let thumbnail = `https://img.youtube.com/vi/${videoMatch[1]}/hqdefault.jpg`

  try {
    const info = await yts({ query: videoUrl })
    if (info?.videos && info.videos.length > 0) {
      const video = info.videos[0]
      title = video.title || "Desconocido"
      artista = video.author?.name || "Desconocido"
      duration = video.timestamp || "?"
      thumbnail = video.thumbnail || thumbnail
    }
  } catch (e) {
    // si falla, quedan los valores por defecto
  }

  let audioDownloadUrl = null
  let apiUsada = "Desconocida"

  const tryDownload = async () => {
    const tryApi = (apiName, urlBuilder) => new Promise(async (resolve, reject) => {
      try {
        const apiUrl = urlBuilder()
        const r = await axios.get(apiUrl, { timeout: 11000 })
        if (r.data?.status && (r.data?.result?.url || r.data?.data?.url)) {
          resolve({ url: r.data.result?.url || r.data.data?.url, api: apiName })
        } else reject(new Error(`${apiName}: No entregó un URL válido`))
      } catch (err) {
        reject(new Error(`${apiName}: ${err.message}`))
      }
    })

    const apis = [
      tryApi("Api 1M", () => `https://mayapi.ooguy.com/ytdl?url=${encodeURIComponent(videoUrl)}&type=mp3&apikey=may-0595dca2`),
      tryApi("Api 2A", () => `https://api-adonix.ultraplus.click/download/ytmp3?apikey=AdonixKeyz11c2f6197&url=${encodeURIComponent(videoUrl)}`),
      tryApi("Api 3F", () => `https://api-adonix.ultraplus.click/download/ytmp3?apikey=Adofreekey&url=${encodeURIComponent(videoUrl)}`)
    ]

    let lastError
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        return await new Promise((resolve, reject) => {
          let settled = false
          let errors = []
          apis.forEach(p => {
            p.then(result => {
              if (!settled) {
                settled = true
                resolve(result)
              }
            }).catch(err => {
              errors.push(err)
              if (errors.length === apis.length && !settled) {
                reject(new Error("No se pudo obtener el audio de ninguna API"))
              }
            })
          })
        })
      } catch (err) {
        lastError = err
        if (attempt < 3) {
          await conn.sendMessage(msg.key.remoteJid, { react: { text: "🔄", key: msg.key } })
        }
        if (attempt === 3) throw lastError
      }
    }
  }

  try {
    const winner = await tryDownload()
    audioDownloadUrl = winner.url
    apiUsada = winner.api

    await conn.sendMessage(
      msg.key.remoteJid,
      {
        image: { url: thumbnail },
        caption: `
> 𝚅𝙸𝙳𝙴𝙾 𝙳𝙾𝚆𝙽𝙻𝙾𝙰𝙳𝙴𝚁

⭒ ִֶָ७ ꯭🎵˙⋆｡ - 𝚃𝚒́𝚝𝚞𝚕𝚘: ${title}
⭒ ִֶָ७ ꯭🎤˙⋆｡ - 𝙰𝚛𝚝𝚒𝚜𝚝𝚊: ${artista}
⭒ ִֶָ७ ꯭🕑˙⋆｡ - 𝙳𝚞𝚛𝚊𝚌𝚒ó𝚗: ${duration}
⭒ ִֶָ७ ꯭📺˙⋆｡ - 𝙲𝚊𝚕𝚒𝚍𝚊𝚍: 128kbps
⭒ ִֶָ७ ꯭🌐˙⋆｡ - 𝙰𝚙𝚒: ${apiUsada}

» 𝘌𝘕𝘝𝘐𝘈𝘕𝘋𝘖 𝘈𝘜𝘋𝘐𝘖  🎧
» 𝘈𝘎𝘜𝘈𝘙𝘋𝘓𝘌 𝘜𝘕 𝘗𝘖𝘊𝘖...

⇆‌ ㅤ◁ㅤㅤ❚❚ㅤㅤ▷ㅤ↻

> \`\`\`© 𝖯𝗈𝗐𝖾𝗋𝖾𝖽 𝖻𝗒 𝗁𝖾𝗋𝗇𝖺𝗇𝖽𝖾𝗓.𝗑𝗒𝗓\`\`\`
`.trim()
      },
      { quoted: msg }
    )

    await conn.sendMessage(
      msg.key.remoteJid,
      {
        audio: { url: audioDownloadUrl },
        mimetype: "audio/mpeg",
        fileName: `${title}.mp3`,
        ptt: false
      },
      { quoted: msg }
    )

    await conn.sendMessage(msg.key.remoteJid, { react: { text: "✅", key: msg.key } })

  } catch (e) {
    const errorMsg = typeof e === "string"
      ? e
      : `❌ *Error:* ${e.message || "Ocurrió un problema"}\n\n🔸 *Posibles soluciones:*\n• Verifica el enlace de YouTube\n• Intenta con otro link\n• Prueba más tarde`

    await conn.sendMessage(
      msg.key.remoteJid,
      { text: errorMsg },
      { quoted: msg }
    )
  }
}

handler.command = ["ytmp3"]
export default handler