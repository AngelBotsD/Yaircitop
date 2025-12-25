import fs from "fs"
import path from "path"

const DIGITS = (s = "") => String(s).replace(/\D/g, "")

function lidParser(participants = []) {
  try {
    return participants.map(v => ({
      id: (typeof v?.id === "string" && v.id.endsWith("@lid") && v.jid) ? v.jid : v.id,
      admin: v?.admin ?? null,
      raw: v
    }))
  } catch {
    return participants || []
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
        const hit = norm.find(n =>
          DIGITS(n?.id || "") === d ||
          DIGITS(n?.raw?.id || "") === d
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

  return Array.from(new Set(out))
}

let handler = async (msg, { conn }) => {
  const chatId = msg.key.remoteJid

  const ctx = msg.message?.extendedTextMessage?.contextInfo
  const mentioned = Array.isArray(ctx?.mentionedJid) ? ctx.mentionedJid : []
  const replied = ctx?.participant ? [ctx.participant] : []
  const targets = [...mentioned, ...replied]

  if (!targets.length) {
    await conn.sendMessage(chatId, {
      text: "📌 *Menciona o responde al admin que quieres quitar.*"
    }, { quoted: msg })
    return
  }

  const realTargets = await mapJidsToReal(conn, chatId, targets)

  let meta = {}
  try {
    meta = await conn.groupMetadata(chatId)
  } catch {}

  const raw = Array.isArray(meta?.participants) ? meta.participants : []
  const norm = lidParser(raw)

  const creatorJid = meta?.owner || null
  const botJid = conn.user?.id?.split?.(":")?.[0]
    ? conn.user.id.split(":")[0] + "@s.whatsapp.net"
    : null

  const isAdminJid = (jid) => {
    const idx = norm.findIndex(p => p?.id === jid)
    if (idx >= 0) {
      const r = raw[idx], n = norm[idx]
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

  const isProtected = (jid) => {
    return (creatorJid && jid === creatorJid) || (botJid && jid === botJid)
  }

  const toDemote = []
  const notAdmin = []
  const protectedOnes = []

  for (const jid of realTargets) {
    if (isProtected(jid)) {
      protectedOnes.push(jid)
      continue
    }
    if (!isAdminJid(jid)) {
      notAdmin.push(jid)
      continue
    }
    toDemote.push(jid)
  }

  let ok = []
  let fail = []

  if (toDemote.length) {
    try {
      await conn.groupParticipantsUpdate(chatId, toDemote, "demote")
      ok = toDemote
    } catch {
      fail = toDemote
    }
  }

  const tag = jid => `@${DIGITS(jid)}`
  const lines = []

  if (ok.length) lines.push(`✅ *Admin quitado a:* ${ok.map(tag).join(", ")}`)
  if (notAdmin.length) lines.push(`ℹ️ *No eran admin:* ${notAdmin.map(tag).join(", ")}`)
  if (protectedOnes.length) lines.push(`🛡️ *No se puede quitar:* ${protectedOnes.map(tag).join(", ")}`)
  if (fail.length) lines.push(`❌ *Error al quitar admin a:* ${fail.map(tag).join(", ")}`)

  await conn.sendMessage(chatId, {
    text: lines.join("\n"),
    mentions: [...ok, ...notAdmin, ...protectedOnes, ...fail]
  }, { quoted: msg })

  await conn.sendMessage(chatId, {
    react: { text: ok.length ? "✅" : "⚠️", key: msg.key }
  }).catch(() => {})
}

handler.group = true
handler.admin = true
handler.botAdmin = true;
handler.customPrefix = /^\.?(demote|quitaradmin|removeadmin)/i
handler.command = new RegExp()
export default handler