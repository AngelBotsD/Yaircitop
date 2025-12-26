let handler = async (m, { conn, participants }) => {

  let botJid = conn.user.jid
  let owners = (global.owner || []).map(o =>
    o.replace(/[^0-9]/g, '') + '@s.whatsapp.net'
  )

  let candidatos = participants
    .filter(p =>
      p.id !== botJid &&
      !owners.includes(p.id)
    )
    .map(p => p.id)

  if (!candidatos.length)
    return m.reply('❌ No hay usuarios válidos para la ruleta.')

  let elegido = candidatos[Math.floor(Math.random() * candidatos.length)]

  try {
    await conn.groupParticipantsUpdate(m.chat, [elegido], 'remove')

    await conn.sendMessage(
      m.chat,
      {
        text: `🎯 *RULETABAN*\n\nFuiste el elegido 😈 @${elegido.split('@')[0]}`,
        mentions: [elegido]
      },
      { quoted: m }
    )
  } catch {
    m.reply('❌ No pude expulsar al usuario.')
  }
}

handler.help = ['𝖱𝗎𝗅𝖾𝗍𝖺𝖻𝖺𝗇']
handler.tags = ['𝖦𝖱𝖴𝖯𝖮𝖲']
handler.command = ['ruletaban']
handler.group = true
handler.admin = true
handler.botAdmin = true
export default handler