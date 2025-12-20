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
    react: { text: "🔎", key: m.key }
  })

  try {
    const res = await axios.get(`${API_BASE}/api/spotify/search`, {
      params: {
        q: text,
        apikey: API_KEY
      }
    })

    if (!res.data?.status) throw "No se encontraron resultados"

    const s = res.data.result[0]

    const caption = `
🎵 *${s.title}*
👤 ${s.artist}
⏱️ ${s.duration}
🔗 ${s.url}
`.trim()

    await conn.sendMessage(
      m.chat,
      {
        image: { url: s.thumbnail },
        caption
      },
      { quoted: m }
    )

    if (s.preview) {
      await conn.sendMessage(
        m.chat,
        {
          audio: { url: s.preview },
          mimetype: "audio/mpeg",
          ptt: false
        },
        { quoted: m }
      )
    }

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