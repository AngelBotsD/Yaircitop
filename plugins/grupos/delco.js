import fs from 'fs'
import path from 'path'

const jsonPath = path.resolve('./comandos.json')

export async function handler(m, { conn }) {

  if (!m.isGroup) {
    return conn.sendMessage(m.chat, { text: '❌ Solo en grupos.' }, { quoted: m })
  }

  const st =
    m.message?.stickerMessage ||
    m.message?.ephemeralMessage?.message?.stickerMessage ||
    m.message?.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage ||
    m.message?.ephemeralMessage?.message?.extendedTextMessage?.contextInfo?.quotedMessage?.stickerMessage

  if (!st) {
    return conn.sendMessage(m.chat, {
      text: '❌ Responde al sticker.'
    }, { quoted: m })
  }

  if (!fs.existsSync(jsonPath)) {
    return conn.sendMessage(m.chat, {
      text: '❌ No hay stickers registrados.'
    }, { quoted: m })
  }

  const map = JSON.parse(fs.readFileSync(jsonPath, 'utf-8') || '{}')

  const rawSha = st.fileSha256 || st.fileSha256Hash || st.filehash
  const candidates = []

  if (rawSha) {
    if (Buffer.isBuffer(rawSha)) candidates.push(rawSha.toString('base64'))
    else if (ArrayBuffer.isView(rawSha)) candidates.push(Buffer.from(rawSha).toString('base64'))
    else if (typeof rawSha === 'string') candidates.push(rawSha)
  }

  let foundKey = null
  let data = null

  for (const k of candidates) {
    if (map[k]) {
      foundKey = k
      data = map[k]
      break
    }
  }

  if (!foundKey || !data) {
    return conn.sendMessage(m.chat, {
      text: '❌ Este sticker no tiene comando.'
    }, { quoted: m })
  }

  if (data.chat !== m.chat) {
    return conn.sendMessage(m.chat, {
      text: '❌ Este sticker no pertenece a este grupo.'
    }, { quoted: m })
  }

  delete map[foundKey]
  fs.writeFileSync(jsonPath, JSON.stringify(map, null, 2))

  await conn.sendMessage(m.chat, { react: { text: '🗑️', key: m.key } })
  return conn.sendMessage(m.chat, {
    text: '✅ Sticker eliminado correctamente.'
  }, { quoted: m })
}

handler.command = ['delco']
handler.rowner = true
export default handler