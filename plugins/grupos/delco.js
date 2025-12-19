import fs from 'fs';
import path from 'path';

const jsonPath = path.resolve('./comandos.json');

export async function handler(m, { conn }) {
  const st = m.message?.stickerMessage || m.message?.ephemeralMessage?.message?.stickerMessage;
  if (!st) {
    return conn.sendMessage(m.chat, { text: "❌ Responde a un sticker para desvincularlo de un comando." }, { quoted: m });
  }

  if (!fs.existsSync(jsonPath)) fs.writeFileSync(jsonPath, '{}');
  const map = JSON.parse(fs.readFileSync(jsonPath, 'utf-8') || '{}');

  const rawSha = st.fileSha256 || st.fileSha256Hash || st.filehash;
  if (!rawSha) return conn.sendMessage(m.chat, { text: "❌ No se pudo obtener el hash del sticker." }, { quoted: m });

  let hash;
  if (Buffer.isBuffer(rawSha)) hash = rawSha.toString('base64');
  else if (ArrayBuffer.isView(rawSha)) hash = Buffer.from(rawSha).toString('base64');
  else hash = rawSha.toString();

  if (!map[hash]) {
    return conn.sendMessage(m.chat, { text: "⚠️ Este sticker no está vinculado a ningún comando." }, { quoted: m });
  }

  const oldCommand = map[hash];
  delete map[hash];
  fs.writeFileSync(jsonPath, JSON.stringify(map, null, 2));

  return conn.sendMessage(m.chat, { text: `✅ Sticker desvinculado del comando: ${oldCommand}` }, { quoted: m });
}

handler.command = ['delco'];
handler.rowner = true; // solo dueño del bot
export default handler;