// plugins/addco.js
import fs from 'fs'
import path from 'path'

const jsonPath = path.resolve('./comandos.json')

export async function handler(m, { conn }) {
  // Verificar que el mensaje sea un sticker
  const st =
    m.message?.stickerMessage ||
    m.message?.ephemeralMessage?.message?.stickerMessage ||
    m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage ||
    m.message?.ephemeralMessage?.message?.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage

  if (!st) {
    return conn.sendMessage(m.chat, {
      text: "❌ Responde a un sticker para asignarle un comando."
    }, { quoted: m })
  }

  // Obtener el comando a vincular (solo argumento, sin el nombre del plugin)
  const text = m.text?.split(/\s+/).slice(1).join(" ").trim()
  if (!text) {
    return conn.sendMessage(m.chat, {
      text: "❌ Debes indicar el comando que quieres asociar al sticker.\nEjemplo: .addco kick"
    }, { quoted: m })
  }

  // Crear comandos.json si no existe
  if (!fs.existsSync(jsonPath)) fs.writeFileSync(jsonPath, '{}')
  const map = JSON.parse(fs.readFileSync(jsonPath, 'utf-8') || '{}')

  // Obtener hash del sticker
  const rawSha = st.fileSha256 || st.fileSha256Hash || st.filehash
  if (!rawSha) return conn.sendMessage(m.chat, { text: "❌ No se pudo obtener el hash del sticker." }, { quoted: m })

  let hash
  if (Buffer.isBuffer(rawSha)) hash = rawSha.toString('base64')
  else if (ArrayBuffer.isView(rawSha)) hash = Buffer.from(rawSha).toString('base64')
  else hash = rawSha.toString()

  // Guardar en JSON
  map[hash] = text.startsWith('.') ? text : '.' + text
  fs.writeFileSync(jsonPath, JSON.stringify(map, null, 2))

  // Reaccionar y enviar confirmación
  await conn.sendMessage(m.chat, { react: { text: "✅", key: m.key } })
  return conn.sendMessage(m.chat, {
    text: `✅ Sticker vinculado al comando: ${map[hash]}`,
    quoted: m
  })
}

handler.command = ['addco']
handler.rowner = true // solo el dueño del bot puede usarlo
export default handler