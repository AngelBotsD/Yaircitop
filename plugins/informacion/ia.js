import fetch from 'node-fetch';

let handler = async (m, { conn }) => {

  const body =
    m.text ||
    m.message?.extendedTextMessage?.text ||
    m.message?.conversation ||
    '';

  const isTagged = m.mentionedJid?.includes(conn.user.jid) || false;
  const isCommand = /^[\.]?(bot|gemini)/i.test(body);

  if (!isTagged && !isCommand) return;

  let query = body
    .replace(new RegExp(`@${conn.user.jid.split('@')[0]}`, 'i'), '')
    .replace(/^[\.]?(bot|gemini)\s*/i, '')
    .trim();

  if (!query) {
    return m.reply(
      '¡Hola!\nMi nombre es Elite Bot\n¿En qué te puedo ayudar? ♥️'
    );
  }

  try {
    await conn.sendPresenceUpdate('composing', m.chat);

    const apiUrl = `https://apis-starlights-team.koyeb.app/starlight/gemini?text=${encodeURIComponent(query)}`;
    const res = await fetch(apiUrl);
    const data = await res.json();

    await m.reply(data.result || '🔴 Error en la API');
  } catch (e) {
    console.error(e);
    await m.reply('❌ Error al procesar');
  }
};

handler.customPrefix = /^(\.?bot|\.?gemini|@\d+)/i;
handler.command = new RegExp;
handler.tags = ['ai'];

export default handler;