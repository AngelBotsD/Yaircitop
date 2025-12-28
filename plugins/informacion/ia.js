let handler = async (m, { conn }) => {
  await conn.reply(m.chat, "hola si", m)
}

handler.all = async function (m) {
  if (!m.mentionedJid || !m.mentionedJid.includes(this.user.jid)) return
  await m.reply("hola si")
}

export default handler