import axios from "axios";

const handler = async (m, { conn, text }) => {
  if (!text && m.quoted?.text) text = m.quoted.text;
  if (!text) {
    return conn.sendMessage(
      m.chat,
      { text: "Escribe un texto o responde un mensaje para crear el sticker Brat.", ...global.rcanal },
      { quoted: m }
    );
  }

  try {
    // Reacción inicial
    await conn.sendMessage(m.chat, { react: { text: "🕒", key: m.key } });

    // <-- Aquí pones tu API_KEY directamente
    const API_KEY = "Angxlllll";

    // POST a la API
    const r = await axios.post(
      "https://api-sky.ultraplus.click/brat",
      { text: text, size: 512 },
      { headers: { apikey: API_KEY } }
    );

    // Enviar sticker
    await conn.sendMessage(
      m.chat,
      { sticker: { url: r.data.url }, ...global.rcanal },
      { quoted: m }
    );

    // Reacción final
    await conn.sendMessage(m.chat, { react: { text: "✅", key: m.key } });

  } catch (e) {
    console.error(e);
    await conn.sendMessage(m.chat, { react: { text: "❌", key: m.key } });
    return conn.sendMessage(
      m.chat,
      { text: `Ocurrió un error al generar el sticker.\n\n💡 Razón: ${e.message}`, ...global.rcanal },
      { quoted: m }
    );
  }
};

handler.help = ["brat <texto>"];
handler.tags = ["stickers"];
handler.command = /^brat$/i;
export default handler;