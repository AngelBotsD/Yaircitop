const DIGITS = (s = "") => String(s || "").replace(/\D/g, "");

const handler = async (m, { conn }) => {
  const chatId = m.key.remoteJid;

  // Validación: solo grupos
  if (!chatId.endsWith("@g.us")) {
    return conn.sendMessage(chatId, { text: "⚠️ Este comando solo funciona en grupos." }, { quoted: m });
  }

  const senderId = m.key.participant || m.sender || "";
  const senderNum = DIGITS(senderId);

  // Metadata del grupo
  let meta;
  try { meta = await conn.groupMetadata(chatId); } 
  catch {
    return conn.sendMessage(chatId, { text: "❌ No pude leer la metadata del grupo." }, { quoted: m });
  }

  const participantes = Array.isArray(meta?.participants) ? meta.participants : [];

  // Reconocimiento admin/owner/bot
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

  // React inicial
  await conn.sendMessage(chatId, { react: { text: "🔗", key: m.key } }).catch(() => {});

  try {
    const safeFetch = async (url, timeout = 5000) => {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), timeout);
      try {
        const res = await fetch(url, { signal: controller.signal });
        return res.ok ? Buffer.from(await res.arrayBuffer()) : null;
      } catch {
        return null;
      } finally {
        clearTimeout(id);
      }
    };

    const [code] = await Promise.all([
      conn.groupInviteCode(chatId).catch(() => null)
    ]);

    const groupName = meta.subject || "Grupo";
    const link = code ? `https://chat.whatsapp.com/${code}` : "Sin enlace disponible";

    const fallback = "https://files.catbox.moe/xr2m6u.jpg";
    let ppBuffer = null;

    try {
      const url = await conn.profilePictureUrl(chatId, "image").catch(() => null);
      if (url && url !== "not-authorized" && url !== "not-exist") {
        ppBuffer = await safeFetch(url, 6000);
      }
    } catch { }

    if (!ppBuffer) ppBuffer = await safeFetch(fallback);

    await conn.sendMessage(chatId, { image: ppBuffer, caption: `*${groupName}*\n${link}` }, { quoted: m });

  } catch (err) {
    console.error("⚠️ Error en comando .link:", err);
    return conn.sendMessage(chatId, { text: "❌ Ocurrió un error al generar el enlace." }, { quoted: m });
  }
};

handler.help = ["𝖫𝗂𝗇𝗄"];
handler.tags = ["𝖦𝖱𝖴𝖯𝖮𝖲"];
handler.customPrefix = /^\.?(link)$/i;
handler.command = new RegExp();
export default handler;