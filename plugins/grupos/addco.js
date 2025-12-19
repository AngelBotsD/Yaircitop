import fs from "fs"
import path from "path"

const jsonPath = path.resolve("./comandos.json")

// 🔹 Asegurar que el archivo exista
function ensureFile () {
  if (!fs.existsSync(jsonPath)) {
    fs.writeFileSync(jsonPath, JSON.stringify({}, null, 2))
  }
}

const handler = async (m, { conn, args, isOwner, isAdmin }) => {
  const chatId = m.chat
  const isGroup = m.isGroup

  // ================== PERMISOS ==================
  if (isGroup) {
    if (!isOwner && !isAdmin && !m.fromMe) {
      return m.reply("🚫 *Solo administradores, owner o el bot pueden usar este comando.*")
    }
  } else {
    if (!isOwner && !m.fromMe) {
      return m.reply("🚫 *Este comando solo puede usarlo el owner o el bot en privado.*")
    }
  }
  // =============================================

  // Debe responder a un sticker
  const quoted =
    m.message?.extendedTextMessage?.contextInfo?.quotedMessage

  if (!quoted?.stickerMessage) {
    return m.reply("❌ *Responde a un sticker para asignarle un comando.*")
  }

  // Comando a asignar
  const comando = args.join(" ").trim()
  if (!comando) {
    return m.reply("⚠️ *Especifica el comando.*\nEjemplo:\n.addco kick")
  }

  // Obtener hash del sticker
  const rawSha =
    quoted.stickerMessage.fileSha256 ||
    quoted.stickerMessage.fileSha256Hash ||
    quoted.stickerMessage.filehash

  if (!rawSha) {
    return m.reply("❌ *No se pudo obtener el ID del sticker.*")
  }

  const keys = []

  if (Buffer.isBuffer(rawSha)) {
    keys.push(rawSha.toString("base64"))
    keys.push(Array.from(rawSha).toString())
  } else if (ArrayBuffer.isView(rawSha)) {
    const buf = Buffer.from(rawSha)
    keys.push(buf.toString("base64"))
    keys.push(Array.from(rawSha).toString())
  } else if (typeof rawSha === "string") {
    keys.push(rawSha)
  }

  // 🔹 Crear archivo si no existe
  ensureFile()

  // Leer JSON
  let data = {}
  try {
    data = JSON.parse(fs.readFileSync(jsonPath, "utf-8"))
  } catch {
    data = {}
  }

  // Guardar todas las claves
  for (const k of keys) {
    if (k) data[k] = comando
  }

  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2))

  // Reacción
  await conn.sendMessage(chatId, {
    react: { text: "✅", key: m.key }
  })

  // Confirmación
  await m.reply(
    `✅ *Sticker vinculado al comando con éxito*\n\n➤ ${comando}`
  )
}

handler.command = ["addco"]
handler.tags = ["tools"]
handler.help = ["addco <comando>"]

export default handler