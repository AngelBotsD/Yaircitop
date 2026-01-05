import axios from "axios"
import yts from "yt-search"

const API_BASE = (global.APIs.may || "").replace(/\/+$/, "")
const API_KEY  = global.APIKeys.may || ""

const handler = async (msg, { conn, args = [], usedPrefix = ".", command = "play" }) => {
  const chatId = msg.key.remoteJid
  const text = args.join(" ").trim()
  const input = String(text || "").trim()

  if (input.startsWith("audio|") || input.startsWith("video|")) {
    const [type, url] = input.split("|")

    await conn.sendMessage(chatId, {
      react: { text: type === "audio" ? "🎵" : "🎬", key: msg.key }
    })

    try {
      const dlType = type === "audio" ? "Mp3" : "Mp4"

      const { data } = await axios.get(
        `${API_BASE}/ytdl?url=${encodeURIComponent(url)}&type=${dlType}&apikey=${API_KEY}`
      )

      if (!data?.status || !data.result?.url)
        throw new Error("No se pudo obtener el archivo")

      if (type === "audio") {
        await conn.sendMessage(chatId, {
          audio: { url: data.result.url },
          mimetype: "audio/mpeg",
          ptt: false
        }, { quoted: msg })
      } else {
        await conn.sendMessage(chatId, {
          video: { url: data.result.url },
          mimetype: "video/mp4"
        }, { quoted: msg })
      }

      await conn.sendMessage(chatId, {
        react: { text: "✅", key: msg.key }
      })

    } catch (e) {
      console.error(e)
      await conn.sendMessage(chatId, {
        text: "❌ Error al descargar"
      }, { quoted: msg })
    }

    return
  }

  if (!input) {
    return conn.sendMessage(chatId, {
      text: `✳️ Usa:\n${usedPrefix}${command} <nombre de canción>\nEj:\n${usedPrefix}${command} Lemon Tree`
    }, { quoted: msg })
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

    const buttons = [
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
    ]

    await conn.sendMessage(chatId, {
      image: { url: video.thumbnail },
      caption,
      buttons,
      headerType: 4
    }, { quoted: msg })

    await conn.sendMessage(chatId, {
      react: { text: "✅", key: msg.key }
    })

  } catch (err) {
    console.error("play error:", err)
    await conn.sendMessage(chatId, {
      text: `❌ Error: ${err?.message || "Fallo interno"}`
    }, { quoted: msg })
  }
}

handler.command = ["play", "ytplay"]
handler.help = ["play <texto>"]
handler.tags = ["descargas"]

export default handler