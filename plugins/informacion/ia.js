import fetch from 'node-fetch'

const gemini = {
  getNewCookie: async () => {
    const res = await fetch(
      "https://gemini.google.com/_/BardChatUi/data/batchexecute?rpcids=maGuAc",
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: "f.req=%5B%5B%5B%22maGuAc%22%2C%22%5B0%5D%22%2Cnull%2C%22generic%22%5D%5D%5D&"
      }
    )

    const cookie = res.headers.get("set-cookie")
    if (!cookie) throw new Error("No cookie")
    return cookie.split(";")[0]
  },

  ask: async (prompt) => {
    const cookie = await gemini.getNewCookie()

    const body = new URLSearchParams({
      "f.req": JSON.stringify([
        null,
        JSON.stringify([[prompt], ["es-MX"], null])
      ])
    })

    const res = await fetch(
      "https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?hl=es-MX&rt=c",
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
          cookie
        },
        body
      }
    )

    const text = await res.text()
    const match = [...text.matchAll(/^\d+\n(.+?)\n/gm)]

    for (const m of match.reverse()) {
      try {
        const arr = JSON.parse(m[1])
        const p = JSON.parse(arr[0][2])
        return p[4][0][1][0]
      } catch {}
    }

    throw new Error("No response")
  }
}


let handler = async (m, { conn }) => {
  if (!m?.text) return

  // 🟡 Normalizar JID del bot
  const botJid =
    (conn.user?.id?.split(':')[0] + '@s.whatsapp.net') ||
    conn.user?.jid

  // 🟡 Obtener contextInfo de cualquier tipo de mensaje
  const ctx =
    m.msg?.contextInfo ||
    m.message?.extendedTextMessage?.contextInfo ||
    m.message?.imageMessage?.contextInfo ||
    m.message?.videoMessage?.contextInfo ||
    m.message?.buttonsMessage?.contextInfo ||
    m.message?.templateButtonReplyMessage?.contextInfo ||
    {}

  const mentioned = ctx.mentionedJid || []

  // 🛑 Si NO mencionan al bot → salir
  if (!mentioned.includes(botJid)) return

  // 🧹 Limpiar @ del texto
  const clean = m.text.replace(/@\S+/g, "").trim()

  if (!clean) return m.reply("👋 Hola, dime algo y te respondo.")

  try {
    await conn.sendPresenceUpdate("composing", m.chat)

    const reply = await gemini.ask(clean)

    return m.reply(reply || "⚠️ No recibí respuesta")
  } catch (e) {
    console.error(e)
    return m.reply("❌ Error al conectar con la IA")
  }
}

handler.command = new RegExp
handler.tags = ['ai']

export default handler