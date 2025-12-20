import axios from "axios"

const API_BASE = "https://api-adonix.ultraplus.click"
const API_KEY = "Angxlllll"

const handler = async (m, { conn, text }) => {
  if (!text?.trim()) {
    return conn.sendMessage(
      m.chat,
      { text: "✳️ Usa:\n.spotify <canción>" },
      { quoted: m }
    )
  }

  await conn.sendMessage(m.chat, {
    react: { text: "🎧", key: m.key }
  })

  try {
    const res = await axios.get(`${API_BASE}/spotify`, {
      params: {
        text,
        apikey: API_KEY
      }
    })

    if (!res.data?.status) throw "No se pudo obtener la canción"

    const { song, downloadUrl } = res.data

    const caption = `
🎵 *${song.title}*
👤 ${song.artist}
⏱️ ${song.duration}
🔗 ${song.spotifyUrl}
`.trim()

    await conn.sendMessage(
      m.chat,
      {
        image: { url: song.thumbnail },
        caption
      },
      { quoted: m }
    )

    await conn.sendMessage(
      m.chat,
      {
        audio: { url: downloadUrl },
        mimetype: "audio/mpeg",
        ptt: false
      },
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

handler.command = ["spotify"]
export default handler