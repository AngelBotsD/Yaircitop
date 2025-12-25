let handler = async (m, { conn, participants }) => {

  const tag = jid => `@${jid.split('@')[0]}`

  let user =
    m.mentionedJid?.[0] ||
    m.quoted?.sender

  if (!user) {
    return conn.sendMessage(m.chat, {
      text: '☁️ *Responde o menciona al usuario*.',
      contextInfo: { stanzaId: m.key.id, participant: m.sender, quotedMessage: m.message }
    })
  }

  const ok = []
  const notAdmin = []
  const fail = []

  try {
    const p = participants.find(v => v.id === user || v.jid === user)

    if (!p?.admin) {
      notAdmin.push(user)
    } else {
      await conn.groupParticipantsUpdate(m.chat, [user], 'demote')
      ok.push(user)
    }
  } catch (e) {
    console.error(e)
    fail.push(user)
  }

  let lines = []
  if (ok.length) lines.push(`✅ *Admin quitado a:* ${ok.map(tag).join(", ")}`)
  if (notAdmin.length) lines.push(`ℹ️ *No eran admin:* ${notAdmin.map(tag).join(", ")}`)
  if (fail.length) lines.push(`❌ *Error al quitar admin a:* ${fail.map(tag).join(", ")}`)

  await conn.sendMessage(m.chat, {
    text: lines.join('\n'),
    mentions: [...ok, ...notAdmin, ...fail]
  })
}

handler.group = true
handler.admin = true
handler.botAdmin = true;
handler.customPrefix = /^\.?(demote|quitaradmin|removeadmin)/i
handler.command = new RegExp()
export default handler