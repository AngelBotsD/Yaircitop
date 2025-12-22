const handler = async (m, { conn }) => {
  const chatId = m.key.remoteJid
  if (!chatId.endsWith("@g.us")) {
    return conn.sendMessage(chatId, { text: "⚠️ Este comando solo funciona en grupos." }, { quoted: m })
  }

  const senderId = m.key.participant || m.sender || ""
  const senderNum = String(senderId || "").replace(/\D/g, "")

  // metadata del grupo
  let meta
  try { meta = await conn.groupMetadata(chatId) } catch {
    return conn.sendMessage(chatId, { text: "❌ No pude leer la metadata del grupo." }, { quoted: m })
  }

  const participantes = Array.isArray(meta?.participants) ? meta.participants : []

  // Verifica si es admin real
  const isAdmin = participantes.some(p => {
    const ids = [p?.id, p?.jid].filter(Boolean)
    const match = ids.some(id => String(id || "").replace(/\D/g, "") === senderNum)
    const role =
      p?.admin === "admin" ||
      p?.admin === "superadmin" ||
      p?.admin === 1 ||
      p?.isAdmin === true ||
      p?.isSuperAdmin === true
    return match && role
  })

  if (!isAdmin) {
    return conn.sendMessage(chatId, { text: "❌ No eres administrador del grupo." }, { quoted: m })
  }

  const ctx = m.message?.extendedTextMessage?.contextInfo
  if (!ctx?.stanzaId) {
    return conn.sendMessage(chatId, { text: "Responde al mensaje que deseas eliminar." }, { quoted: m })
  }

  try {
    // eliminar mensaje citado
    await conn.sendMessage(chatId, {
      delete: {
        remoteJid: chatId,
        fromMe: false,
        id: ctx.stanzaId,
        participant: ctx.participant
      }
    })

    // eliminar comando
    await conn.sendMessage(chatId, {
      delete: {
        remoteJid: chatId,
        fromMe: m.key.fromMe || false,
        id: m.key.id,
        participant: m.key.participant || undefined
      }
    })
  } catch {
    return conn.sendMessage(chatId, { text: "No se pudo eliminar el mensaje." }, { quoted: m })
  }
}

handler.help = ["𝖣𝖾𝗅𝖾𝗍𝖾"]
handler.tags = ["𝖦𝖱𝖴𝖯𝖮𝖲"]
handler.customPrefix = /^\.?(del|delete)$/i
handler.command = new RegExp()
handler.group = true
handler.admin = true

export default handler