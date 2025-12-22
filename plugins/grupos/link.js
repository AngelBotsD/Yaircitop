const DIGITS = (s = "") => String(s || "").replace(/\D/g, "");

const handler = async (m, { conn }) => {
  const chatId = m.key.remoteJid;

  if (!chatId.endsWith("@g.us")) {
    return conn.sendMessage(chatId, { text: "⚠️ Este comando solo funciona en grupos." }, { quoted: m });
  }

  const senderId = m.key.participant || m.sender || "";
  const senderNum = DIGITS(senderId);

  let meta;
  try { 
    meta = await conn.groupMetadata(chatId); 
  } catch {
    return conn.sendMessage(chatId, { text: "❌ No pude leer la metadata del grupo." }, { quoted: m });
  }

  const participantes = Array.isArray(meta?.participants) ? meta.participants : [];

  const botNum = DIGITS(conn.user?.id?.split(":")[0] || "");
  const isOwner = Array.isArray(global.owner) && global.owner.some(id => DIGITS(id) === senderNum);
  const isBot = senderNum === botNum;
  const isAdmin = participantes.some(p => {
    const ids = [p?.id, p?.jid].filter(Boolean);
    const match = ids.some(id => DIGITS(id) === senderNum);
    const role =
      p?.admin === "admin" ||
      p?.admin === "superadmin" ||
      p?.admin === 1 ||
      p?.isAdmin === true ||
      p?.isSuperAdmin === true;
    return match && role;
  });

  if (!isAdmin && !isOwner && !isBot) {
    return conn.sendMessage(chatId, { text: "❌ Solo administradores, owner o el bot pueden usar este comando." }, { quoted: m });
  }

  await conn.sendMessage(chatId, { react: { text: "🔗", key: m.key } }).catch(() => {});

  try {
    const code = await conn.groupInviteCode(chatId).catch(() => null);

    const groupName = meta.subject || "Grupo";
    const link = code ? `https://chat.whatsapp.com/${code}` : "Sin enlace disponible";

    const fallback = "https://files.catbox.moe/xr2m6u.jpg";
    let ppBuffer = null;

    try {
      const url = await conn.profilePictureUrl(chatId, "image").catch(() => null);
      if (url && !["not-authorized", "not-exist"].includes(url)) {
        const res = await fetch(url);
        if (res.ok) ppBuffer = Buffer.from(await res.arrayBuffer());
      }
    } catch {}

    if (!ppBuffer) {
      const res = await fetch(fallback);
      if (res.ok) ppBuffer = Buffer.from(await res.arrayBuffer());
    }

    const message = {
      interactiveMessage: {
        header: {
          title: groupName,
          hasMediaAttachment: true,
          imageMessage: ppBuffer
        },
        body: {
          text: `Enlace del grupo:\n${link}`
        },
        footer: {
          text: "Powered by Angel.xyz"
        },
        nativeFlowMessage: {
          buttons: [
            {
              name: "cta_copy",
              buttonParamsJson: JSON.stringify({
                display_text: "📋 Copiar link",
                copy_code: link
              })
            }
          ]
        }
      }
    };

    await conn.sendMessage(chatId, message, { quoted: m });

  } catch (err) {
    return conn.sendMessage(chatId, { text: "❌ Ocurrió un error al generar el enlace." }, { quoted: m });
  }
};

handler.help = ["Link"];
handler.tags = ["GRUPOS"];
handler.customPrefix = /^\.?(link)$/i;
handler.command = new RegExp();
export default handler;