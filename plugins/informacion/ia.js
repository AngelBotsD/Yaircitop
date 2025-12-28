let handler = async (m, { conn }) => {

  if (!m.text) return

  const mentioned =
    m.text.startsWith("@") ||
    m.text.toLowerCase().includes(conn.user.name.toLowerCase())

  if (!mentioned) return

  let text = m.text
    .replace(/^@\S+\s*/i, "")
    .trim()

  if (!text) {
    return m.reply("hola si")
  }

  return m.reply("hola si")
}

handler.customPrefix = /^@/i
handler.command = new RegExp
export default handler