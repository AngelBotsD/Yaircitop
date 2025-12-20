import axios from "axios";

const API_URL = "https://api-sky.ultraplus.click/brat";
const API_KEY = process.env.API_KEY || "Angxlllll";

let handler = async (m, { conn, text }) => {
  if (!text) {
    return m.reply("✏️ Escribe un texto para usar *brat*");
  }

  try {
    const res = await axios.post(
      API_URL,
      { text },
      {
        headers: { apikey: API_KEY },
        responseType: "arraybuffer"
      }
    );

    await conn.sendMessage(
      m.chat,
      { image: Buffer.from(res.data), caption: "✨ Brat" },
      { quoted: m }
    );

  } catch (e) {
    console.error(e);
    m.reply("❌ Error al generar el brat");
  }
};

handler.help = ["brat <texto>"];
handler.tags = ["maker"];
handler.command = /^brat$/i;

export default handler;