import fs from "fs"
import path from "path"

const jsonPath = path.resolve("./comandos.json")

let handler = async (m, { conn }) => {

  // Obtener sticker (normal / citado / efímero)
  const st =
    m.message?.stickerMessage ||
    m.message?.ephemeralMessage?.message?.stickerMessage ||
    m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage ||
    m.message?.ephemeralMessage?.message?.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage

  if (!st) {
    return conn.sendMessage(
      m.chat,
      { text: "❌ Responde a un *sticker* para asignarle un comando." },
      { quoted: m }
    )
  }

  // Texto del comando
  const text = m.text?.split(/\s+/).slice(1).join(" ").trim()
  if (!text) {
    return conn.sendMessage(
      m.chat,
      {
        text: "❌ Debes indicar el comando.\nEjemplo:\n*.addco kick*"
      },
      { quoted: m }
    )
  }

  // Crear archivo si no existe
  if (!fs.existsSync(jsonPath))
    fs.writeFileSync(jsonPath, "{}")

  const map = JSON.parse(fs.readFileSync(jsonPath, "utf-8") || "{}")

  // Obtener hash del sticker
  const rawSha = st.fileSha256 || st.fileSha256Hash || st.filehash
  if (!rawSha) {
    return conn.sendMessage(
      m.chat,
      { text: "❌ No se pudo obtener el hash del sticker." },
      { quoted: m }
    )
  }

  let hash
  if (Buffer.isBuffer(rawSha)) hash = rawSha.toString("base64")
  else if (ArrayBuffer.isView(rawSha)) hash = Buffer.from(rawSha).toString("base64")
  else hash = rawSha.toString()

  // 🔒 Guardar SOLO para este grupo
  map[m.chat] ||= {}
  map[m.chat][hash] = text.startsWith(".") ? text : "." + text

  fs.writeFileSync(jsonPath, JSON.stringify(map, null, 2))

  // Reacción + confirmación
  await conn.sendMessage(m.chat, {
    react: { text: "✅", key: m.key }
  })

  return conn.sendMessage(
    m.chat,
    { text: `✅ Sticker vinculado al comando:\n*${map[m.chat][hash]}*\n\n📌 Solo funcionará en este grupo.` },
    { quoted: m }
  )
}

handler.command = ["addco"]
handler.group = true
handler.admin = true

export default handler