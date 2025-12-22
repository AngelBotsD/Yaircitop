import fs from "fs"
import path from "path"

const jsonPath = path.resolve("./comandos.json")
const DIGITS = (s = "") => String(s || "").replace(/\D/g, "")

export async function handler(m, { conn }) {
  const chatId = m.chat
  const isGroup = chatId.endsWith("@g.us")

  if (!isGroup) {
    return conn.sendMessage(
      chatId,
      { text: "⚠️ Este comando solo funciona en grupos." },
      { quoted: m }
    )
  }

  // sender real (LID safe)
  const senderId = m.key.participant || m.sender || ""
  const senderNum = DIGITS(senderId)

  // metadata REAL (Ado21/bly)
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

  // ¿es admin real?
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

  if (!isAdmin) {
    return conn.sendMessage(
      chatId,
      { text: "❌ No eres administrador del grupo." },
      { quoted: m }
    )
  }

  // —— sticker detection (tu lógica original) ——
  const st =
    m.message?.stickerMessage ||
    m.message?.ephemeralMessage?.message?.stickerMessage ||
    m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage ||
    m.message?.ephemeralMessage?.message?.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage

  if (!st) {
    return conn.sendMessage(
      chatId,
      { text: "❌ Responde a un sticker para asignarle un comando." },
      { quoted: m }
    )
  }

  const text = m.text?.split(/\s+/).slice(1).join(" ").trim()
  if (!text) {
    return conn.sendMessage(
      chatId,
      {
        text:
          "❌ Debes indicar el comando que quieres asociar al sticker.\nEjemplo: .addco kick"
      },
      { quoted: m }
    )
  }

  if (!fs.existsSync(jsonPath))
    fs.writeFileSync(jsonPath, "{}")

  const map = JSON.parse(fs.readFileSync(jsonPath, "utf-8") || "{}")

  const rawSha = st.fileSha256 || st.fileSha256Hash || st.filehash
  if (!rawSha) {
    return conn.sendMessage(
      chatId,
      { text: "❌ No se pudo obtener el hash del sticker." },
      { quoted: m }
    )
  }

  let hash
  if (Buffer.isBuffer(rawSha)) hash = rawSha.toString("base64")
  else if (ArrayBuffer.isView(rawSha)) hash = Buffer.from(rawSha).toString("base64")
  else hash = rawSha.toString()

  map[hash] = text.startsWith(".") ? text : "." + text
  fs.writeFileSync(jsonPath, JSON.stringify(map, null, 2))

  await conn.sendMessage(chatId, {
    react: { text: "✅", key: m.key }
  })

  return conn.sendMessage(
    chatId,
    { text: `✅ Sticker vinculado al comando: ${map[hash]}` },
    { quoted: m }
  )
}

handler.command = ["addco"]
export default handler