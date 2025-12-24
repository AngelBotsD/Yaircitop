import axios from "axios"

const API_BASE = (process.env.API_BASE || "https://api-sky.ultraplus.click").replace(/\/+$/, "")
const API_KEY = process.env.API_KEY || "Russellxz"
const MAX_TIMEOUT = 60000
const COOLDOWN_MS = 1200

// ───── API ─────
function pickTextFromApi(data) {
  const txt = data?.result?.result
  return (typeof txt === "string" ? txt : "").trim()
}

async function askGroq(prompt) {
  const { data, status } = await axios.post(
    `${API_BASE}/ai`,
    { prompt },
    {
      headers: {
        apikey: API_KEY,
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      timeout: MAX_TIMEOUT
    }
  )

  if (status !== 200) throw new Error("HTTP error")
  if (!data || data.status !== true) throw new Error("API error")

  const text = pickTextFromApi(data)
  if (!text) throw new Error("No text")

  return text
}

// ───── UTILS ─────
function getRawText(m) {
  return (
    m?.message?.conversation ||
    m?.message?.extendedTextMessage?.text ||
    m?.message?.imageMessage?.caption ||
    m?.message?.videoMessage?.caption ||
    ""
  ).trim()
}

function isGroupJid(jid = "") {
  return typeof jid === "string" && jid.endsWith("@g.us")
}

function extractTextAfterMention(m, botJid) {
  const text = getRawText(m)
  if (!text) return ""

  const mentions = m.mentionedJid || []
  if (!mentions.includes(botJid)) return ""

  // eliminar TODAS las menciones del texto
  let clean = text
  for (const jid of mentions) {
    const num = jid.split("@")[0]
    clean = clean.replace(new RegExp(`@${num}`, "g"), "")
  }

  return clean.trim()
}

function chunkText(s, n = 3500) {
  const out = []
  for (let i = 0; i < s.length; i += n) out.push(s.slice(i, i + n))
  return out
}

// ───── LISTENER ─────
function ensureMentionListener(conn) {
  if (conn._mentionAIListener) return
  conn._mentionAIListener = true

  conn.ev.on("messages.upsert", async ev => {
    for (const m of ev.messages || []) {
      try {
        const chatId = m?.key?.remoteJid
        if (!chatId) continue
        if (!isGroupJid(chatId)) continue
        if (m?.key?.fromMe) continue

        const rawText = getRawText(m)
        if (!rawText) continue

        const pref = (global.prefixes && global.prefixes[0]) || "."
        if (rawText.startsWith(pref)) continue

        const botJid = conn.user?.jid
        if (!botJid) continue

        const prompt = extractTextAfterMention(m, botJid)
        if (!prompt) continue

        const now = Date.now()
        if (conn._lastMentionAt && now - conn._lastMentionAt < COOLDOWN_MS) continue
        conn._lastMentionAt = now

        let reply
        try {
          reply = await askGroq(prompt)
        } catch {
          continue
        }

        for (const part of chunkText(reply)) {
          await conn.sendMessage(chatId, { text: part }, { quoted: m })
        }

      } catch {}
    }
  })
}

// ───── COMANDO ─────
const handler = async (msg, { conn }) => {
  ensureMentionListener(conn)
  return conn.sendMessage(
    msg.key.remoteJid,
    {
      text:
        "🤖 Listo.\n" +
        "Ahora solo respondo cuando me mencionan.\n\n" +
        "Ejemplo:\n@bot 1+1"
    },
    { quoted: msg }
  )
}

handler.command = ["groq"]
handler.help = ["groq"]
handler.tags = ["tools"]

export default handler