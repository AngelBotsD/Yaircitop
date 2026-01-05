import axios from "axios"
import yts from "yt-search"

const handler = async (msg, { conn, args = [], usedPrefix = ".", command = "play" }) => {
  const chatId = msg.key.remoteJid
  const text = args.join(" ").trim()
  const input = String(text || "").trim()

  /* ================= BOTONES ================= */
  if (input.startsWith("audio|") || input.startsWith("video|")) {
    const [type, url] = input.split("|")

    await conn.sendMessage(chatId, {
      react: { text: type === "audio" ? "🎵" : "🎬", key: msg.key }
    })

    try {
      const apikey = globalThis?.apikey
      if (!apikey) throw new Error("Falta globalThis.apikey")

      /* ===== AUDIO (MÉTODO ADONIX) ===== */
      if (type === "audio") {
        const { data } = await axios.get(
          "https://api-adonix.ultraplus.click/download/ytaudio",
          {
            params: { apikey, url },
            timeout: 900000,
            headers: { Accept: "application/json" },
            validateStatus: () => true
          }
        )

        if (!data || typeof data !== "object")
          throw new Error("Respuesta inválida de la API")

        if (data.status !== true)
          throw new Error(data?.message || data?.error || "status=false")

        if (!data?.data?.url || !data?.data?.title)
          throw new Error("Respuesta incompleta de la API")

        await conn.sendMessage(
          chatId,
          {
            audio: { url: data.data.url },
            mimetype: "audio/mpeg",
            fileName: `${data.data.title}.mp3`,
            ptt: false
          },
          { quoted: msg }
        )
      }

      /* ===== VIDEO (MÉTODO ADONIX) ===== */
      if (type === "video") {
        const { data } = await axios.get(
          "https://api-adonix.ultraplus.click/download/ytvideo",
          {
            params: { apikey, url },
            timeout: 900000,
            headers: { Accept: "application/json" },
            validateStatus: () => true
          }
        )

        if (!data || typeof data !== "object")
          throw new Error("Respuesta inválida de la API")

        if (data.status !== true)
          throw new Error(data?.message || data?.error || "status=false")

        if (!data?.data?.url || !data?.data?.title)
          throw new Error("Respuesta incompleta de la API")

        await conn.sendMessage(
          chatId,
          {
            video: { url: data.data.url },
            mimetype: "video/mp4",
            fileName: `${data.data.title}.mp4`
          },
          { quoted: msg }
        )
      }

      await conn.sendMessage(chatId, {
        react: { text: "✅", key: msg.key }
      })
    } catch (e) {
      console.error(e)
      await conn.sendMessage(
        chatId,
        { text: "❌ Error al descargar" },
        { quoted: msg }
      )
    }
    return
  }

  /* ================= BÚSQUEDA ================= */
  if (!input) {
    return conn.sendMessage(
      chatId,
      {
        text: `✳️ Usa:\n${usedPrefix}${command} <nombre de canción>\nEj:\n${usedPrefix}${command} Lemon Tree`
      },
      { quoted: msg }
    )
  }

  await conn.sendMessage(chatId, {
    react: { text: "🕒", key: msg.key }
  })

  try {
    const search = await yts(input)
    if (!search?.videos?.length)
      throw new Error("Sin resultados")

    const video = search.videos[0]

    const caption =
`⭒ ִֶָ७ ꯭🎵˙⋆｡ - *𝚃𝚒́𝚝𝚞𝚕𝚘:* ${video.title}
⭒ ִֶָ७ ꯭🎤˙⋆｡ - *𝙰𝚛𝚝𝚒𝚜𝚝𝚊:* ${video.author?.name || "Desconocido"}
⭒ ִֶָ७ ꯭🕑˙⋆｡ - *𝙳𝚞𝚛𝚊𝚌𝚒ó𝚗:* ${video.timestamp || "Desconocida"}

Selecciona el formato 👇

⇆‌ ㅤ◁ㅤ❚❚ㅤ▷ㅤ↻

> \`\`\`© Powered by Angel.xyz\`\`\`
`

    await conn.sendMessage(
      chatId,
      {
        image: { url: video.thumbnail },
        caption,
        buttons: [
          {
            buttonId: `.play audio|${video.url}`,
            buttonText: { displayText: "🎵 Audio" },
            type: 1
          },
          {
            buttonId: `.play video|${video.url}`,
            buttonText: { displayText: "🎬 Video" },
            type: 1
          }
        ],
        headerType: 4
      },
      { quoted: msg }
    )

    await conn.sendMessage(chatId, {
      react: { text: "✅", key: msg.key }
    })
  } catch (err) {
    console.error("play error:", err)
    await conn.sendMessage(
      chatId,
      { text: `❌ Error: ${err?.message || "Fallo interno"}` },
      { quoted: msg }
    )
  }
}

handler.command = ["play", "ytplay"]
handler.help = ["play <texto>"]
handler.tags = ["descargas"]

export default handler