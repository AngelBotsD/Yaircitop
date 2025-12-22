import { prepareWAMessageMedia } from "@whiskeysockets/baileys"

const DIGITS = (s = "") => String(s || "").replace(/\D/g, "")

const handler = async (m, { conn }) => {
  const chatId = m.key.remoteJid

  if (!chatId.endsWith("@g.us")) {
    return conn.sendMessage(
      chatId,
      { text: "⚠️ Este comando solo funciona en grupos." },
      { quoted: m }
    )
  }

  await conn.sendMessage(chatId, {
    react: { text: "🔗", key: m.key }
  }).catch(() => {})

  try {
    const meta = await conn.groupMetadata(chatId)
    const groupName = meta.subject || "Grupo"

    const code = await conn.groupInviteCode(chatId).catch(() => null)
    const link = code
      ? `https://chat.whatsapp.com/${code}`
      : "Sin enlace disponible"

    let ppBuffer = null
    const fallback = "https://files.catbox.moe/xr2m6u.jpg"

    try {
      const url = await conn.profilePictureUrl(chatId, "image").catch(() => null)
      if (url && !["not-authorized", "not-exist"].includes(url)) {
        const res = await fetch(url)
        if (res.ok) ppBuffer = Buffer.from(await res.arrayBuffer())
      }
    } catch {}

    if (!ppBuffer) {
      const res = await fetch(fallback)
      if (res.ok) ppBuffer = Buffer.from(await res.arrayBuffer())
    }

    const media = await prepareWAMessageMedia(
      { image: ppBuffer },
      { upload: conn.waUploadToServer }
    )

    const message = {
      interactiveMessage: {
        header: {
          title: groupName,
          hasMediaAttachment: true,
          imageMessage: media.imageMessage
        },
        body: {
          text: `Enlace del grupo:\n${link}`
        },
        footer: {
          text: "Powered by Angel.xyz"
        },
        nativeFlowMessage: {
          buttons: [
            {
              name: "cta_copy",
              buttonParamsJson: JSON.stringify({
                display_text: "📋 Copiar link",
                copy_code: link
              })
            }
          ]
        }
      }
    }

    await conn.sendMessage(chatId, message, { quoted: m })

  } catch (err) {
    console.error("link error:", err)
    await conn.sendMessage(
      chatId,
      { text: "❌ Ocurrió un error al generar el enlace." },
      { quoted: m }
    )
  }
}

handler.help = ["link"]
handler.tags = ["grupos"]
handler.customPrefix = /^\.?(link)$/i
handler.command = new RegExp()

export default handler