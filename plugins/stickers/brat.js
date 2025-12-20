import axios from "axios";
import fs from "fs";
import path from "path";
import ffmpeg from "fluent-ffmpeg";
import { webp } from "webp-converter";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const tempFolder = path.join(__dirname, "../tmp");
if (!fs.existsSync(tempFolder)) fs.mkdirSync(tempFolder);

const API_URL = "https://api-sky.ultraplus.click";
const API_KEY = process.env.API_KEY || "Angxlllll";

// ================== utils ==================

function randomFileName(ext) {
  return crypto.randomBytes(6).toString("hex") + "." + ext;
}

async function imageToWebp(media) {
  const tmpIn = path.join(tempFolder, randomFileName("jpg"));
  const tmpOut = path.join(tempFolder, randomFileName("webp"));
  fs.writeFileSync(tmpIn, media);

  await new Promise((resolve, reject) => {
    ffmpeg(tmpIn)
      .on("error", reject)
      .on("end", resolve)
      .addOutputOptions([
        "-vcodec", "libwebp",
        "-vf",
        "scale='min(320,iw)':min(320,ih):force_original_aspect_ratio=decrease,fps=15,pad=320:320:-1:-1:color=white@0.0",
        "-loop", "0",
        "-preset", "default",
        "-an",
        "-vsync", "0"
      ])
      .toFormat("webp")
      .save(tmpOut);
  });

  const buff = fs.readFileSync(tmpOut);
  fs.unlinkSync(tmpIn);
  fs.unlinkSync(tmpOut);
  return buff;
}

async function addExif(webpBuffer, metadata) {
  const tmpIn = path.join(tempFolder, randomFileName("webp"));
  const tmpOut = path.join(tempFolder, randomFileName("webp"));
  fs.writeFileSync(tmpIn, webpBuffer);

  const json = {
    "sticker-pack-id": "brat-ultraplus",
    "sticker-pack-name": metadata.packname,
    "sticker-pack-publisher": metadata.author,
    emojis: [""]
  };

  const exifAttr = Buffer.from([
    0x49, 0x49, 0x2A, 0x00,
    0x08, 0x00, 0x00, 0x00,
    0x01, 0x00, 0x41, 0x57,
    0x07, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x16, 0x00,
    0x00, 0x00
  ]);

  const jsonBuff = Buffer.from(JSON.stringify(json), "utf-8");
  const exif = Buffer.concat([exifAttr, jsonBuff]);
  exif.writeUIntLE(jsonBuff.length, 14, 4);

  await webp.mux({
    image: tmpIn,
    output: tmpOut,
    exif
  });

  fs.unlinkSync(tmpIn);
  return tmpOut;
}

async function writeExifImg(media, metadata) {
  const webpBuff = await imageToWebp(media);
  return await addExif(webpBuff, metadata);
}

// ================== handler ==================

let handler = async (m, { conn, text }) => {
  if (!text) return m.reply("✏️ Usa: *.brat texto*");

  try {
    const res = await axios.post(
      API_URL,
      { text },
      {
        headers: { apikey: API_KEY },
        responseType: "arraybuffer"
      }
    );

    const stickerPath = await writeExifImg(res.data, {
      packname: "Brat",
      author: "UltraPlus"
    });

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