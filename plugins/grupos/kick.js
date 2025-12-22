const DIGITS = (s = "") => String(s || "").replace(/\D/g, "")

const handler = async (m, { conn }) => {
  const chatId = m.chat
  const isGroup = chatId.endsWith("@g.us")

  if (!isGroup) {
    return conn.sendMessage(
      chatId,
      { text: "⚠️ Este comando solo funciona en grupos." },
      { quoted: m }
    )
  }

  // sender real (LID safe)
  const senderId = m.key.participant || m.sender || ""
  const senderNum = DIGITS(senderId)

  // metadata REAL (Ado21/bly)
  let meta
  try {
    meta = await conn.groupMetadata(chatId)
  } catch {
    return conn.sendMessage(
      chatId,
      { text: "❌ No pude leer la metadata del grupo." },
      { quoted: m }
    )
  }

  const participantes = Array.isArray(meta?.participants)
    ? meta.participants
    : []

  // ¿es admin real?
  const isAdmin = participantes.some(p => {
    const ids = [p?.id, p?.jid].filter(Boolean)
    const match = ids.some(id => DIGITS(id) === senderNum)
    const role =
      p?.admin === "admin" ||
      p?.admin === "superadmin" ||
      p?.admin === 1 ||
      p?.isAdmin === true ||
      p?.isSuperAdmin === true
    return match && role
  })

  if (!isAdmin) {
    return conn.sendMessage(
      chatId,
      { text: "❌ No eres administrador del grupo." },
      { quoted: m }
    )
  }

  // detectar target
  const target = (m.mentionedJid && m.mentionedJid.length)
    ? m.mentionedJid[0]
    : m.quoted?.sender

  if (!target) {
    return conn.sendMessage(
      chatId,
      { text: "*🗡️ 𝙼𝚎𝚗𝚌𝚒𝚘𝚗𝚊 𝚘 𝚛𝚎𝚜𝚙𝚘𝚗𝚍𝚎 𝙰𝚕 𝚞𝚜𝚞𝚊𝚛𝚒𝚘 𝚚𝚞𝚎 𝙳𝚎𝚜𝚎𝚊𝚜 𝙴𝚕𝚒𝚖𝚒𝚗𝚊𝚛*" },
      { quoted: m }
    )
  }

  try {
    await conn.groupParticipantsUpdate(chatId, [target], "remove")
    await conn.sendMessage(
      chatId,
      { text: "*🗡️ 𝚄𝚂𝚄𝙰𝚁𝙸𝙾 𝙴𝙻𝙸𝙼𝙸𝙽𝙰𝙳𝙾*" },
      { quoted: m }
    )
  } catch (e) {
    return global.dfail?.("botAdmin", m, conn)
  }
}

handler.customPrefix = /^(?:\.?kick)(?:\s+|$)/i
handler.command = new RegExp()

export default handler