import fs from "fs"
import path from "path"

const DIGITS = (s = "") => String(s).replace(/\D/g, "")

function lidParser(participants = []) {
  try {
    return participants.map(v => ({
      id: typeof v?.id === "string" && v.id.endsWith("@lid") && v.jid ? v.jid : v.id,
      admin: v?.admin ?? null,
      raw: v
    }))
  } catch {
    return participants || []
  }
}

async function isAdminByNumber(conn, chatId, number) {
  try {
    const meta = await conn.groupMetadata(chatId)
    const raw = Array.isArray(meta?.participants) ? meta.participants : []
    const norm = lidParser(raw)

    for (let i = 0; i < raw.length; i++) {
      const r = raw[i]
      const n = norm[i]
      const isAdm =
        r?.admin === "admin" ||
        r?.admin === "superadmin" ||
        n?.admin === "admin" ||
        n?.admin === "superadmin"

      if (!isAdm) continue

      const ids = [r?.id, r?.jid, n?.id]
      if (ids.some(x => DIGITS(x || "") === number)) return true
    }
    return false
  } catch {
    return false
  }
}

async function mapJidsToReal(conn, chatId, jids = []) {
  const out = []
  try {
    const meta = await conn.groupMetadata(chatId)
    const raw = Array.isArray(meta?.participants) ? meta.participants : []
    const norm = lidParser(raw)

    for (const jid of jids) {
      if (typeof jid !== "string") continue

      if (jid.endsWith("@s.whatsapp.net")) {
        out.push(jid)
        continue
      }

      if (jid.endsWith("@lid")) {
        const idx = raw.findIndex(p => p?.id === jid)
        if (idx >= 0) {
          const real =
            raw[idx]?.jid?.endsWith("@s.whatsapp.net")
              ? raw[idx].jid
              : norm[idx]?.id?.endsWith("@s.whatsapp.net")
              ? norm[idx].id
              : null

          if (real) {
            out.push(real)
            continue
          }
        }

        const d = DIGITS(jid)
        const hit = norm.find(
          n => DIGITS(n?.id || "") === d || DIGITS(n?.raw?.id || "") === d
        )

        if (hit?.id?.endsWith("@s.whatsapp.net")) {
          out.push(hit.id)
          continue
        }
      }

      out.push(jid)
    }
  } catch {
    return jids
  }

  return [...new Set(out)]
}

let handler = async (m, { conn }) => {
  const chatId = m.chat

  const user =
    m.mentionedJid?.[0] ||
    m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0] ||
    m.quoted?.sender

  if (!user) {
    await conn.sendMessage(chatId, {
      text: "☁️ *Responde o menciona al usuario que deseas promover*",
      contextInfo: {
        stanzaId: m.key.id,
        participant: m.sender,
        quotedMessage: m.message
      }
    })
    await conn.sendMessage(chatId, { react: { text: "🏞️", key: m.key } })
    return
  }

  const realTargets = await mapJidsToReal(conn, chatId, [user])

  let meta = {}
  try {
    meta = await conn.groupMetadata(chatId)
  } catch {}

  const raw = Array.isArray(meta?.participants) ? meta.participants : []
  const norm = lidParser(raw)

  const isAdminJid = jid => {
    const idx = norm.findIndex(p => p?.id === jid)
    if (idx >= 0) {
      const r = raw[idx]
      const n = norm[idx]
      return (
        r?.admin === "admin" ||
        r?.admin === "superadmin" ||
        n?.admin === "admin" ||
        n?.admin === "superadmin"
      )
    }

    const d = DIGITS(jid)
    const hit = norm.find(p => DIGITS(p?.id || "") === d)
    return !!(hit && (hit.admin === "admin" || hit.admin === "superadmin"))
  }

  const toPromote = []
  const already = []

  for (const jid of realTargets) {
    if (isAdminJid(jid)) already.push(jid)
    else toPromote.push(jid)
  }

  if (already.length) {
    await conn.sendMessage(chatId, {
      text: "☁️ *Este usuario ya es Admin*"
    }, { quoted: m })
    await conn.sendMessage(chatId, { react: { text: "🧾", key: m.key } })
    return
  }

  try {
    await conn.groupParticipantsUpdate(chatId, toPromote, "promote")
    await conn.sendMessage(chatId, { react: { text: "✅", key: m.key } })
  } catch (e) {
    console.error(e)
  }
}

handler.help = ["𝖯𝗋𝗈𝗆𝗈𝗍𝖾"]
handler.tags = ["𝖦𝖱𝖴𝖯𝖮𝖲"]
handler.customPrefix = /^\.?promote/i
handler.command = new RegExp()
handler.group = true
handler.admin = true

export default handler