import fetch from "node-fetch"

let handler = async (m, { conn }) => {

  const mentioned =
    m.message?.extendedTextMessage?.contextInfo?.mentionedJid || []

  const isMention = mentioned.includes(conn.user.jid)
  const isCommand = /^[\.]?(bot|gemini)/i.test(m.text)

  if (!isMention && !isCommand) return

  let text = m.text || ""

  if (isMention) {
    const botNumber = conn.user.jid.split("@")[0]
    text = text.replace(new RegExp(`@${botNumber}`, "gi"), "").trim()
  }

  if (isCommand) {
    text = text.replace(/^[\.]?(bot|gemini)\s*/i, "").trim()
  }

  if (!text) {
    return m.reply(
      "¡Hola!\nMi nombre es Bot\n¿En qué te puedo ayudar? ♥️"
    )
  }

  try {
    await conn.sendPresenceUpdate("composing", m.chat)

    const apiUrl =
      "https://apis-starlights-team.koyeb.app/starlight/gemini?text=" +
      encodeURIComponent(text)

    const res = await fetch(apiUrl)
    const data = await res.json()

    await m.reply(data.result || "🔴 Error en la API")
  } catch (e) {
    console.error(e)
    await m.reply("❌ Error al procesar")
  }
}

handler.customPrefix = /^(\.?bot|\.?gemini)/i
handler.command = new RegExp
handler.tags = ["ai"]

export default handler