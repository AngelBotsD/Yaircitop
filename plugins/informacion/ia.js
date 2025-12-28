import fetch from 'node-fetch'

const gemini = {
  getNewCookie: async function () {
    const res = await fetch(
      "https://gemini.google.com/_/BardChatUi/data/batchexecute?rpcids=maGuAc&source-path=%2F&bl=boq_assistant-bard-web-server_20250814.06_p1&f.sid=-7816331052118000090&hl=en-US&_reqid=173780&rt=c",
      {
        headers: {
          "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        },
        body: "f.req=%5B%5B%5B%22maGuAc%22%2C%22%5B0%5D%22%2Cnull%2C%22generic%22%5D%5D%5D&",
        method: "POST",
      }
    )

    const cookieHeader = res.headers.get('set-cookie')
    if (!cookieHeader) throw new Error('No cookie')
    return cookieHeader.split(';')[0]
  },

  ask: async function (prompt, previousId = null) {
    if (!prompt?.trim()) throw new Error("Mensaje vacío")

    let resumeArray = null
    let cookie = null

    if (previousId) {
      try {
        const s = Buffer.from(previousId, 'base64').toString()
        const j = JSON.parse(s)
        resumeArray = j.newResumeArray
        cookie = j.cookie
      } catch {}
    }

    const headers = {
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
      "x-goog-ext-525001261-jspb": "[1,null,null,null,\"9ec249fc9ad08861\",null,null,null,[4]]",
      "cookie": cookie || await this.getNewCookie(),
    }

    const b = [[prompt], ["en-US"], resumeArray]
    const a = [null, JSON.stringify(b)]
    const body = new URLSearchParams({ "f.req": JSON.stringify(a) })

    const response = await fetch(
      "https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?hl=en-US&rt=c",
      { method: 'POST', headers, body }
    )

    const data = await response.text()
    const match = [...data.matchAll(/^\d+\n(.+?)\n/gm)]

    for (const m of match.reverse()) {
      try {
        const arr = JSON.parse(m[1])
        const p = JSON.parse(arr[0][2])
        const text = p[4][0][1][0]
        const newResumeArray = [...p[1], p[4][0][0]]
        const id = Buffer.from(JSON.stringify({ newResumeArray, cookie: headers.cookie })).toString('base64')
        return { text, id }
      } catch {}
    }

    throw new Error("No response")
  }
}

const sessions = {}

let handler = async (m, { conn }) => {
  if (!m.text) return

  const text = m.text.trim()

  if (!text.startsWith("@")) return

  let query = text.replace(/^@\S*\s*/i, "").trim()

  if (!query) {
    return m.reply("hola si 😎")
  }

  try {
    await conn.sendPresenceUpdate("composing", m.chat)

    const prev = sessions[m.sender]
    const res = await gemini.ask(query, prev)
    sessions[m.sender] = res.id

    await m.reply(res.text)
  } catch (e) {
    console.error(e)
    await m.reply("❌ Error con la IA")
  }
}

handler.all = true
handler.tags = ['ai']

export default handler