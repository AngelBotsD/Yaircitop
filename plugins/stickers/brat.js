import axios from "axios";
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import crypto from "crypto";

const tempFolder = path.join(process.cwd(), "tmp");
if (!fs.existsSync(tempFolder)) fs.mkdirSync(tempFolder);

function randomFileName(ext) {
  return crypto.randomBytes(6).toString("hex") + "." + ext;
}

async function imageToSticker(media) {
  const tmpIn = path.join(tempFolder, randomFileName("jpg"));
  const tmpOut = path.join(tempFolder, randomFileName("webp"));
  fs.writeFileSync(tmpIn, media);

  await new Promise((resolve, reject) => {
    ffmpeg(tmpIn)
      .on("end", resolve)
      .on("error", reject)
      .outputOptions([
        "-vcodec", "libwebp",
        "-vf", "scale=320:320:force_original_aspect_ratio=decrease,pad=320:320:-1:-1:color=0x00000000",
        "-loop", "0",
        "-preset", "default",
        "-an",
        "-vsync", "0"
      ])
      .toFormat("webp")
      .save(tmpOut);
  });

  fs.unlinkSync(tmpIn);
  return tmpOut;
}

let handler = async (m, { conn, text }) => {
  if (!text) return m.reply("✏️ Usa: *.brat texto*");

  try {
    const res = await axios.post(
      "https://api-sky.ultraplus.click/brat",
      { text },
      { headers: { apikey: process.env.API_KEY || "TU_API_KEY" }, responseType: "arraybuffer" }
    );

    const stickerPath = await imageToSticker(res.data);

    await conn.sendMessage(
      m.chat,
      { sticker: fs.readFileSync(stickerPath) },
      { quoted: m }
    );

    fs.unlinkSync(stickerPath);

  } catch (e) {
    console.error(e);
    m.reply("❌ Error al generar el brat");
  }
};

handler.help = ["brat <texto>"];
handler.tags = ["sticker"];
handler.command = /^brat$/i;

export default handler;