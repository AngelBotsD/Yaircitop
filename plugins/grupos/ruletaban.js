let handler = async (m, { conn, participants }) => {
  if (!m.isGroup) return conn.sendMessage(m.chat, { text: '⚠️ Este comando solo funciona en grupos.' }, { quoted: m });

  const senderNum = String(m.sender || '').replace(/\D/g, '');

  // metadata del grupo
  let meta;
  try { meta = await conn.groupMetadata(m.chat); } 
  catch { return conn.sendMessage(m.chat, { text: '❌ No pude leer la metadata del grupo.' }, { quoted: m }); }

  const participantes = Array.isArray(meta?.participants) ? meta.participants : [];

  const botNum = String(conn.user?.id?.split(':')[0] || '').replace(/\D/g, '');
  const isOwner = global.owner?.some(id => id.includes(senderNum));
  const isBot = senderNum === botNum;
  const isAdmin = participantes.some(p => {
    const ids = [p?.id, p?.jid].filter(Boolean);
    const match = ids.some(id => String(id || '').replace(/\D/g, '') === senderNum);
    const role = p?.admin === 'admin' || p?.admin === 'superadmin' || p?.isAdmin === true || p?.isSuperAdmin === true;
    return match && role;
  });

  if (!isAdmin && !isOwner && !isBot) 
    return conn.sendMessage(m.chat, { text: '❌ Solo administradores, owner o el bot pueden usar este comando.' }, { quoted: m });

  let botId = (conn.user.id || conn.user.jid || "").split(':')[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';

  let candidates = participantes
    .filter(p => {
      let pid = p.id.split(':')[0];
      return pid !== botId && p.admin !== 'superadmin';
    })
    .map(p => p.id);

  if (!candidates.length) return conn.sendMessage(m.chat, { text: 'No hay candidatos válidos para elegir.' }, { quoted: m });

  let chosen = candidates[Math.floor(Math.random() * candidates.length)];
  let text = `Adiós putita, fuiste elegido @${chosen.split('@')[0]}`;

  await conn.sendMessage(m.chat, { text, mentions: [chosen] }, { quoted: m });

  try {
    await conn.groupParticipantsUpdate(m.chat, [chosen], 'remove');
  } catch (e) {
    return conn.sendMessage(m.chat, { text: 'No pude sacar al usuario (quizás hubo un error).' }, { quoted: m });
  }
};

handler.help = ["𝖱𝗎𝗅𝖾𝗍𝖺𝖻𝖺𝗇"];
handler.tags = ["𝖦𝖱𝖴𝖯𝖮𝖲"];
handler.command = ['ruletaban'];
handler.group = true;
handler.admin = true;

export default handler;