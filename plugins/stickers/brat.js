import axios from "axios"
import { Sticker } from "wa-sticker-formatter"

const API_BASE = (global.APIs.may || "").replace(/\/+$/, "")
const API_KEY = global.APIKeys.may || ""

const handler = async (m, { conn, text }) => {
  if (!text?.trim()) {
    return conn.sendMessage(
      m.chat,
      { text: "✳️ Usa:\n.brat <texto>" },
      { quoted: m }
    )
  }

  await conn.sendMessage(m.chat, {
    react: { text: "🕒", key: m.key }
  })

  try {
    const res = await axios.get(`${API_BASE}/brat`, {
      params: { text, apikey: API_KEY }
    })

    if (!res.data?.status) throw "Error API"

    const imgUrl = res.data.result.url

    const img = await axios.get(imgUrl, {
      responseType: "arraybuffer"
    })

    const sticker = new Sticker(img.data, {
    const senderName = msg.pushName ||      
    "Usuario";
    const metadata = {
    packname: senderName,
    author: ""
    })

    const stickerBuffer = await sticker.toBuffer()

    await conn.sendMessage(
      m.chat,
      { sticker: stickerBuffer },
      { quoted: m }
    )

    await conn.sendMessage(m.chat, {
      react: { text: "✅", key: m.key }
    })

  } catch (e) {
    await conn.sendMessage(
      m.chat,
      { text: `❌ Error: ${e}` },
      { quoted: m }
    )
  }
}

handler.command = ["brat"]
export default handler