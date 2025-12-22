import {
  generateWAMessageFromContent,
  downloadContentFromMessage
} from "@whiskeysockets/baileys"
import fetch from "node-fetch"

const DIGITS = (s = "") => String(s || "").replace(/\D/g, "")

// —— thumbnail ——
let thumb = null
fetch("https://cdn.russellxz.click/28a8569f.jpeg")
  .then(r => r.arrayBuffer())
  .then(b => thumb = Buffer.from(b))
  .catch(() => null)

// —— unwrap helpers ——
function unwrapMessage(m = {}) {
  let n = m
  while (
    n?.viewOnceMessage?.message ||
    n?.viewOnceMessageV2?.message ||
    n?.viewOnceMessageV2Extension?.message ||
    n?.ephemeralMessage?.message
  ) {
    n =
      n.viewOnceMessage?.message ||
      n.viewOnceMessageV2?.message ||
      n.viewOnceMessageV2Extension?.message ||
      n.ephemeralMessage?.message
  }
  return n
}

function getMessageText(m) {
  const msg = unwrapMessage(m.message) || {}
  return (
    m.text ||
    m.msg?.caption ||
    msg?.extendedTextMessage?.text ||
    msg?.conversation ||
    ""
  )
}

async function downloadMedia(msgContent, type) {
  try {
    const stream = await downloadContentFromMessage(msgContent, type)
    let buffer = Buffer.alloc(0)
    for await (const chunk of stream)
      buffer = Buffer.concat([buffer, chunk])
    return buffer
  } catch {
    return null
  }
}

// —— handler ——
const handler = async (m, { conn }) => {
  try {
    const chatId = m.chat
    const isGroup = chatId.endsWith("@g.us")

    if (!isGroup)
      return conn.sendMessage(
        chatId,
        { text: "⚠️ Este comando solo funciona en grupos." },
        { quoted: m }
      )

    // sender real (LID safe)
    const senderId = m.key.participant || m.sender || ""
    const senderNum = DIGITS(senderId)

    // metadata REAL (bly)
    let meta
    try {
      meta = await conn.groupMetadata(chatId)
    } catch {
      return conn.sendMessage(
        chatId,
        { text: "❌ No pude leer la metadata del grupo." },
        { quoted: m }
      )
    }

    const participantes = Array.isArray(meta?.participants)
      ? meta.participants
      : []

    // admin real
    const isAdmin = participantes.some(p => {
      const ids = [p?.id, p?.jid].filter(Boolean)
      const match = ids.some(id => DIGITS(id) === senderNum)
      const role =
        p?.admin === "admin" ||
        p?.admin === "superadmin" ||
        p?.admin === 1 ||
        p?.isAdmin === true ||
        p?.isSuperAdmin === true
      return match && role
    })

    if (!isAdmin)
      return conn.sendMessage(
        chatId,
        { text: "❌ No eres administrador del grupo." },
        { quoted: m }
      )

    // contacto fake (quoted)
    const fkontak = {
      key: {
        remoteJid: chatId,
        fromMe: false,
        id: "Angel"
      },
      message: {
        locationMessage: {
          name: "𝖧𝗈𝗅𝖺, 𝖲𝗈𝗒 𝖠𝗇𝗀𝖾𝗅 𝖡𝗈𝗍",
          jpegThumbnail: thumb
        }
      },
      participant: "0@s.whatsapp.net"
    }

    const content = getMessageText(m)
    if (!/^\.?n(\s|$)/i.test(content.trim())) return

    await conn.sendMessage(chatId, {
      react: { text: "🗣️", key: m.key }
    }).catch(() => {})

    // menciones (orden real)
    const seen = new Set()
    const users = []
    for (const p of participantes) {
      const jid = p?.id || p?.jid
      if (!jid) continue
      const d = DIGITS(jid)
      if (d && !seen.has(d)) {
        seen.add(d)
        users.push(jid)
      }
    }

    const q = m.quoted ? unwrapMessage(m.quoted) : unwrapMessage(m)
    const mtype = q.mtype || Object.keys(q.message || {})[0] || ""

    const isMedia = [
      "imageMessage",
      "videoMessage",
      "audioMessage",
      "stickerMessage"
    ].includes(mtype)

    const userText = content.trim().replace(/^\.?n(\s|$)/i, "")
    const originalCaption = (q.msg?.caption || q.text || "").trim()
    const finalCaption = userText || originalCaption || "🔊 Notificación"

    if (isMedia) {
      let buffer = null

      if (q[mtype]) {
        const detected = mtype.replace("Message", "").toLowerCase()
        buffer = await downloadMedia(q[mtype], detected)
      }

      if (!buffer && q.download)
        buffer = await q.download()

      const msg = { mentions: users }

      if (mtype === "audioMessage") {
        msg.audio = buffer
        msg.mimetype = "audio/mpeg"
        msg.ptt = false

        await conn.sendMessage(chatId, msg, { quoted: fkontak })

        if (userText)
          await conn.sendMessage(
            chatId,
            { text: userText, mentions: users },
            { quoted: fkontak }
          )
        return
      }

      if (mtype === "imageMessage") {
        msg.image = buffer
        msg.caption = finalCaption
      } else if (mtype === "videoMessage") {
        msg.video = buffer
        msg.caption = finalCaption
        msg.mimetype = "video/mp4"
      } else if (mtype === "stickerMessage") {
        msg.sticker = buffer
      }

      return await conn.sendMessage(chatId, msg, { quoted: fkontak })
    }

    if (m.quoted && !isMedia) {
      const newMsg = conn.cMod(
        chatId,
        generateWAMessageFromContent(
          chatId,
          {
            [mtype || "extendedTextMessage"]:
              q?.message?.[mtype] || { text: finalCaption }
          },
          { quoted: fkontak, userJid: conn.user.id }
        ),
        finalCaption,
        conn.user.jid,
        { mentions: users }
      )

      return await conn.relayMessage(
        chatId,
        newMsg.message,
        { messageId: newMsg.key.id }
      )
    }

    return await conn.sendMessage(
      chatId,
      { text: finalCaption, mentions: users },
      { quoted: fkontak }
    )

  } catch (err) {
    console.error("❌ Error notify:", err)
    return conn.sendMessage(
      m.chat,
      { text: "🔊 Notificación", mentions: [] },
      { quoted: m }
    )
  }
}

handler.help = ["𝖭𝗈𝗍𝗂𝖿𝗒"]
handler.tags = ["𝖦𝖱𝖴𝖯𝖮𝖲"]
handler.customPrefix = /^\.?n(\s|$)/i
handler.command = new RegExp()

export default handler