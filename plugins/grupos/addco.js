import fs from 'fs';
import path from 'path';

const jsonPath = path.resolve('./comandos.json');

function getStickerHash(st) {
  const rawSha = st.fileSha256 || st.fileSha256Hash || st.filehash;
  if (!rawSha) return null;
  if (Buffer.isBuffer(rawSha)) return rawSha.toString('base64');
  if (ArrayBuffer.isView(rawSha)) return Buffer.from(rawSha).toString('base64');
  return rawSha.toString();
}

async function processStickerCommand(m, conn) {
  try {
    // Crear comandos.json si no existe
    if (!fs.existsSync(jsonPath)) fs.writeFileSync(jsonPath, '{}');
    const map = JSON.parse(fs.readFileSync(jsonPath, 'utf-8') || '{}');

    const st = m.message?.stickerMessage || m.message?.ephemeralMessage?.message?.stickerMessage;
    if (!st) return false;

    const hash = getStickerHash(st);
    if (!hash) return false;

    if (map[hash]) {
      const cmd = map[hash].startsWith('.') ? map[hash] : '.' + map[hash];
      m.text = cmd.toLowerCase();
      console.log('✅ Sticker detectado, comando inyectado:', m.text);

      // Ejecutar el handler con el mensaje modificado
      await handler.call(conn, { messages: [m] });
      return true;
    }
  } catch (e) {
    console.error('❌ Error procesando sticker→comando:', e);
  }
  return false;
}

// ======= .addco =======
export async function addco(m, { conn }) {
  const st = m.message?.stickerMessage || m.message?.ephemeralMessage?.message?.stickerMessage;
  if (!st) return conn.sendMessage(m.chat, { text: '❌ Responde a un sticker para asignarle un comando.' }, { quoted: m });

  const text = m.text?.trim();
  if (!text) return conn.sendMessage(m.chat, { text: '❌ Indica el comando a asociar. Ejemplo: .addco .kick' }, { quoted: m });

  if (!fs.existsSync(jsonPath)) fs.writeFileSync(jsonPath, '{}');
  const map = JSON.parse(fs.readFileSync(jsonPath, 'utf-8') || '{}');

  const hash = getStickerHash(st);
  if (!hash) return conn.sendMessage(m.chat, { text: '❌ No se pudo obtener el hash del sticker.' }, { quoted: m });

  const newCommand = text.startsWith('.') ? text : '.' + text;
  if (map[hash]) return conn.sendMessage(m.chat, { text: `⚠️ Este sticker ya está vinculado al comando: ${map[hash]}` }, { quoted: m });

  map[hash] = newCommand;
  fs.writeFileSync(jsonPath, JSON.stringify(map, null, 2));

  return conn.sendMessage(m.chat, { text: `✅ Sticker vinculado al comando: ${map[hash]}` }, { quoted: m });
}

addco.command = ['addco'];
addco.rowner = true; // solo el dueño

// ======= .delco =======
export async function delco(m, { conn }) {
  const st = m.message?.stickerMessage || m.message?.ephemeralMessage?.message?.stickerMessage;
  if (!st) return conn.sendMessage(m.chat, { text: '❌ Responde a un sticker para desvincularlo.' }, { quoted: m });

  if (!fs.existsSync(jsonPath)) fs.writeFileSync(jsonPath, '{}');
  const map = JSON.parse(fs.readFileSync(jsonPath, 'utf-8') || '{}');

  const hash = getStickerHash(st);
  if (!hash || !map[hash]) return conn.sendMessage(m.chat, { text: '❌ Este sticker no está vinculado a ningún comando.' }, { quoted: m });

  const oldCmd = map[hash];
  delete map[hash];
  fs.writeFileSync(jsonPath, JSON.stringify(map, null, 2));

  return conn.sendMessage(m.chat, { text: `✅ Sticker desvinculado del comando: ${oldCmd}` }, { quoted: m });
}

delco.command = ['delco'];
delco.rowner = true;

// ======= Export para el handler principal =======
export async function stickerHandler(m, { conn }) {
  return await processStickerCommand(m, conn);
}