import axios from "axios"
import fs from "fs"
import path from "path"

const API_BASE = (process.env.API_BASE || "https://api-sky.ultraplus.click").replace(/\/+$/, "")
const API_KEY = process.env.API_KEY || "Russellxz"
const MAX_TIMEOUT = 60000

const TTL_MS = 10 * 60 * 1000
const COOLDOWN_MS = 1200

const DATA_DIR = path.join(process.cwd(), "data")
const STATE_FILE = path.join(DATA_DIR, "groq_auto.json")

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true })
  } catch {}
}

function loadState() {
  ensureDataDir()
  try {
    if (!fs.existsSync(STATE_FILE)) return { chats: {} }
    const raw = fs.readFileSync(STATE_FILE, "utf8")
    const j = JSON.parse(raw || "{}")
    if (!j || typeof j !== "object") return { chats: {} }
    if (!j.chats || typeof j.chats !== "object") j.chats = {}
    return j
  } catch {
    return { chats: {} }
  }
}

function saveState(state) {
  ensureDataDir()
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8")
  } catch {}
}

function isExpired(chatState) {
  return !chatState || !chatState.until || Date.now() > Number(chatState.until)
}

function cleanExpired(state) {
  const now = Date.now()
  let changed = false
  for (const [jid, st] of Object.entries(state.chats || {})) {
    if (!st || !st.until || now > Number(st.until)) {
      delete state.chats[jid]
      changed = true
    }
  }
  if (changed) saveState(state)
}

function pickTextFromApi(data) {
  const txt = data?.result?.result
  return (typeof txt === "string" ? txt : "").trim()
}

async function askGroq(prompt) {
  const { data, status: http } = await axios.post(
    `${API_BASE}/ai`,
    { prompt },
    {
      headers: {
        apikey: API_KEY,
        Authorization: `Bearer ${API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: MAX_TIMEOUT,
      validateStatus: s => s >= 200 && s < 600,
    }
  )

  if (http !== 200) throw new Error("HTTP error")
  if (!data || data.status !== true) throw new Error("API error")

  const text = pickTextFromApi(data)
  if (!text) throw new Error("No text")

  return text
}

function getText(m) {
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

function isMentioned(m, botJid) {
  const ctx = m?.message?.extendedTextMessage?.contextInfo
  const mentions = ctx?.mentionedJid || []
  return mentions.includes(botJid)
}

function chunkText(s, n = 3500) {
  const out = []
  const str = String(s || "")
  for (let i = 0; i < str.length; i += n) out.push(str.slice(i, i + n))
  return out
}

function ensureGroqAutoListener(conn) {
  if (conn._groqAutoListener) return
  conn._groqAutoListener = true

  conn.ev.on("messages.upsert", async ev => {
    try {
      const state = loadState()
      cleanExpired(state)

      for (const m of ev.messages || []) {
        try {
          const chatId = m?.key?.remoteJid
          if (!chatId) continue
          if (!isGroupJid(chatId)) continue
          if (m?.key?.fromMe) continue

          const text = getText(m)
          if (!text) continue

          const pref = (global.prefixes && global.prefixes[0]) || "."
          if (text.startsWith(pref)) continue

          const botJid = conn.user?.id?.split(":")[0] + "@s.whatsapp.net"
          const mentioned = isMentioned(m, botJid)

          const st = state.chats?.[chatId]
          const autoActive = st && !isExpired(st)

          if (!autoActive && !mentioned) continue

          const now = Date.now()
          if (st?.busy) continue
          if (st?.lastAt && now - Number(st.lastAt) < COOLDOWN_MS) continue

          const useState = st || { busy: false, lastAt: 0 }
          useState.busy = true
          useState.lastAt = now
          if (autoActive) state.chats[chatId] = useState
          saveState(state)

          let reply = ""
          try {
            reply = await askGroq(text)
          } catch {
            useState.busy = false
            if (autoActive) state.chats[chatId] = useState
            saveState(state)
            continue
          }

          for (const p of chunkText(reply)) {
            await conn.sendMessage(chatId, { text: p }, { quoted: m })
          }

          useState.busy = false
          if (autoActive) state.chats[chatId] = useState
          saveState(state)

        } catch {}
      }
    } catch {}
  })
}

const handler = async (msg, { conn, args, command }) => {
  const chatId = msg.key.remoteJid
  const pref = (global.prefixes && global.prefixes[0]) || "."

  ensureGroqAutoListener(conn)

  if (!isGroupJid(chatId)) {
    return conn.sendMessage(chatId, { text: "❌ Este modo solo funciona en grupos." }, { quoted: msg })
  }

  const sub = String(args?.[0] || "").toLowerCase().trim()
  const state = loadState()
  cleanExpired(state)

  if (!sub || (sub !== "on" && sub !== "off")) {
    const st = state.chats?.[chatId]
    const active = !!st && !isExpired(st)
    const left = active ? Math.max(0, Number(st.until) - Date.now()) : 0
    const mins = active ? Math.ceil(left / 60000) : 0

    return conn.sendMessage(chatId, {
      text:
`🤖 *GROQ AI — AutoChat*
✳️ Usa:
- ${pref}${command} on
- ${pref}${command} off

Estado: ${active ? `✅ ACTIVO (${mins} min aprox)` : "⛔ APAGADO"}`
    }, { quoted: msg })
  }

  if (sub === "on") {
    state.chats[chatId] = {
      until: Date.now() + TTL_MS,
      by: msg?.key?.participant || msg?.participant || "",
      busy: false,
      lastAt: 0,
    }
    saveState(state)

    return conn.sendMessage(chatId, {
      text: "✅ Groq AutoChat ACTIVADO por 10 minutos."
    }, { quoted: msg })
  }

  if (state.chats?.[chatId]) {
    delete state.chats[chatId]
    saveState(state)
  }

  return conn.sendMessage(chatId, { text: "⛔ Groq AutoChat DESACTIVADO." }, { quoted: msg })
}

handler.command = ["groq"]
handler.help = ["groq on", "groq off"]
handler.tags = ["tools"]

export default handler