// plugins/angel-mention.js
import fetch from 'node-fetch'

const API_KEY = 'may-0595dca2'
const API_URL = 'https://mayapi.ooguy.com/ai-pukamind'

const handler = async (m, { conn }) => {
  try {
    if (!m.message) return

    const botJid = conn.user.id.split(':')[0] + '@s.whatsapp.net'
    const botNum = botJid.split('@')[0]

    const text =
      m.text ||
      m.message?.conversation ||
      m.message?.extendedTextMessage?.text ||
      ''

    if (!text) return

    const mentioned =
      m.message?.extendedTextMessage?.contextInfo?.mentionedJid || []

    const isMentioned =
      mentioned.includes(botJid) ||
      text.includes(`@${botNum}`)

    if (!isMentioned) return

    const cleanText = text.replace(new RegExp(`@${botNum}`, 'g'), '').trim()
    if (!cleanText) return m.reply('👀 dime algo después de mencionarme.')

    const url = `${API_URL}?q=${encodeURIComponent(cleanText)}&apikey=${API_KEY}`
    const res = await fetch(url)
    const json = await res.json()

    if (!json?.status) return

    await conn.sendMessage(
      m.chat,
      { text: json.result, mentions: [m.sender] },
      { quoted: m }
    )

  } catch (e) {
    console.error(e)
  }
}

// 🔥 ESTO ES LO IMPORTANTE
handler.all = true

export default handler