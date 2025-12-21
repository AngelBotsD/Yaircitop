import axios from "axios"
import yts from "yt-search"
import fs from "fs"
import path from "path"
import { promisify } from "util"
import { pipeline } from "stream"
import crypto from "crypto"

const streamPipe = promisify(pipeline)
const TMP_DIR = path.join(process.cwd(), "tmp")
fs.rmSync(TMP_DIR, { recursive: true, force: true })
fs.mkdirSync(TMP_DIR, { recursive: true })

const VIDEO_DIR = path.join(process.cwd(), "Canciones", "video")
fs.mkdirSync(VIDEO_DIR, { recursive: true })

const API_BASE = (global.APIs.sky || "").replace(/\/+$/, "")
const API_KEY = global.APIKeys.sky || ""

function safeUnlink(f) { try { f && fs.existsSync(f) && fs.unlinkSync(f) } catch {} }
function validFile(file) {
  if (!file || !fs.existsSync(file)) return false
  const hex = fs.readFileSync(file).slice(0, 16).toString("hex")
  return file.endsWith(".mp4") && hex.includes("66747970")
}

async function downloadStream(url, file) {
  const headers = { "User-Agent": "Mozilla/5.0", Accept: "*/*" }
  if (url.startsWith(API_BASE)) headers.apikey = API_KEY
  const res = await axios.get(url, { responseType: "stream", headers, validateStatus: () => true })
  if (res.status >= 400) throw `HTTP ${res.status}`
  await streamPipe(res.data, fs.createWriteStream(file))
  return file
}

async function callYoutubeResolve(videoUrl) {
  const endpoint = `${API_BASE}/youtube/resolve`
  const res = await axios.post(endpoint, { url: videoUrl, type: "video", quality: "360" }, {
    headers: { "Content-Type": "application/json", apikey: API_KEY },
    validateStatus: () => true
  })
  const data = typeof res.data === "object" ? res.data : null
  if (!data || !data.result?.media?.dl_download) throw "Error API"
  let dl = data.result.media.dl_download
  if (dl.startsWith("/")) dl = API_BASE + dl
  return dl
}

function moveToStore(file, title) {
  const safe = title.replace(/[^\w\s\-().]/gi, "").slice(0, 80)
  const dest = path.join(VIDEO_DIR, `${safe}.mp4`)
  if (fs.existsSync(dest)) { safeUnlink(file); return dest }
  fs.renameSync(file, dest)
  return dest
}

export default async function handler(msg, { conn, text }) {
  if (!text?.trim()) return conn.sendMessage(msg.chat, { text: `✳️ Usa: .play2 <término>` }, { quoted: msg })

  await conn.sendMessage(msg.chat, { react: { text: "🕒", key: msg.key } })

  const res = await yts(text)
  const video = res.videos?.[0]
  if (!video) return conn.sendMessage(msg.chat, { text: "❌ Sin resultados." }, { quoted: msg })

  const { url, title, thumbnail } = video

  await conn.sendMessage(msg.chat, { image: { url: thumbnail }, caption: `🎬 Descargando: ${title}` }, { quoted: msg })

  try {
    const mediaUrl = await callYoutubeResolve(url)
    const tmpFile = path.join(TMP_DIR, `${crypto.randomUUID()}.mp4`)
    await downloadStream(mediaUrl, tmpFile)
    if (!validFile(tmpFile)) throw "Archivo inválido"
    const final = moveToStore(tmpFile, title)

    const buffer = fs.readFileSync(final)
    await conn.sendMessage(msg.chat, { video: buffer, fileName: `${title}.mp4`, mimetype: "video/mp4" }, { quoted: msg })
  } catch (e) {
    await conn.sendMessage(msg.chat, { text: `❌ Error: ${e}` }, { quoted: msg })
  }
}

handler.help = ["play2 <texto>"]
handler.tags = ["descargas"]
handler.command = ["play2"]