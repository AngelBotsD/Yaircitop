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
        JSON.stringify([[prompt], ["en-US"], null])
      ])
    })

    const res = await fetch(
      "https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?hl=en-US&rt=c",
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
  if (!m.text) return

  const botNumber = conn.user.jid.split("@")[0]

  const mentionMatch = m.text.match(/@(\d{5,})/g)
  if (!mentionMatch) return

  const mentionedNumbers = mentionMatch.map(v => v.replace("@", ""))

  if (!mentionedNumbers.includes(botNumber)) return

  let text = m.text.replace(/@\d+\s*/g, "").trim()

  if (!text) {
    return m.reply("hola si")
  }

  try {
    await conn.sendPresenceUpdate("composing", m.chat)
    const res = await gemini.ask(text)
    await m.reply(res)
  } catch (e) {
    console.error(e)
    await m.reply("❌ Error con la IA")
  }
}

handler.customPrefix = /^@/i
handler.command = new RegExp
handler.tags = ['ai']

export default handler