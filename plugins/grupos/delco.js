import fs from "fs";
import path from "path";

const DIGITS = (s = "") => String(s || "").replace(/\D/g, "");

function findParticipantByDigits(parts = [], digits = "") {
  if (!digits) return null;
  return parts.find(
    p => DIGITS(p?.id || "") === digits || DIGITS(p?.jid || "") === digits
  ) || null;
}

const handler = async (msg, { conn }) => {
  const chatId   = msg.key.remoteJid;
  const isGroup  = chatId.endsWith("@g.us");
  const isFromMe = !!msg.key.fromMe;

  const senderRaw = msg.key.participant || msg.key.remoteJid;
  const senderNum = DIGITS(
    typeof msg.realJid === "string" ? msg.realJid : senderRaw
  );

  if (!isGroup) {
    await conn.sendMessage(
      chatId,
      { text: "❌ *Este comando solo funciona en grupos.*" },
      { quoted: msg }
    );
    return;
  }

  const ownerPath = path.resolve("owner.json");
  const owners = fs.existsSync(ownerPath)
    ? JSON.parse(fs.readFileSync(ownerPath, "utf-8"))
    : [];

  const isOwner =
    Array.isArray(owners) && owners.some(([id]) => id === senderNum);

  const botRaw = conn.user?.id || "";
  const botNum = DIGITS(botRaw.split(":")[0]);
  const isBot  = botNum === senderNum;

  let metadata;
  try {
    metadata = await conn.groupMetadata(chatId);
  } catch (e) {
    console.error("[kick] metadata error:", e);
    await conn.sendMessage(
      chatId,
      { text: "❌ No pude leer la metadata del grupo." },
      { quoted: msg }
    );
    return;
  }

  const participantes = Array.isArray(metadata?.participants)
    ? metadata.participants
    : [];

  const authorP = findParticipantByDigits(participantes, senderNum);
  const isAdmin =
    !!authorP &&
    (authorP.admin === "admin" || authorP.admin === "superadmin");

  if (!isAdmin && !isOwner && !isBot && !isFromMe) {
    await conn.sendMessage(
      chatId,
      { text: "⛔ *Solo administradores u owners pueden usar este comando.*" },
      { quoted: msg }
    );
    return;
  }

  const ctx = msg.message?.extendedTextMessage?.contextInfo || {};
  const mentioned = Array.isArray(ctx.mentionedJid) ? ctx.mentionedJid : [];
  let targetDigits = new Set(mentioned.map(j => DIGITS(j)));

  const quoted = ctx.quotedMessage;
  let userQuoted = ctx.participant;

  if (quoted?.extendedTextMessage?.contextInfo?.participant) {
    userQuoted = quoted.extendedTextMessage.contextInfo.participant;
  }

  const st = msg.message?.stickerMessage || quoted?.stickerMessage;

  if (st) {
    const jsonPath = "./comandos.json";
    if (fs.existsSync(jsonPath)) {
      const map = JSON.parse(fs.readFileSync(jsonPath, "utf-8") || "{}");
      const rawSha = st.fileSha256 || st.fileSha256Hash || st.filehash;
      let hash;
      if (Buffer.isBuffer(rawSha)) hash = rawSha.toString("base64");
      else if (ArrayBuffer.isView(rawSha)) hash = Buffer.from(rawSha).toString("base64");
      else hash = rawSha.toString();

      if (map[hash] === ".kick" && userQuoted) {
        targetDigits.add(DIGITS(userQuoted));
      }
    }
  } else if (userQuoted) {
    targetDigits.add(DIGITS(userQuoted));
  }

  if (targetDigits.size === 0) {
    await conn.sendMessage(
      chatId,
      {
        text:
          "📌 *Debes mencionar o responder al mensaje del usuario que deseas expulsar.*\n\n" +
          "Ejemplo: *.kick @usuario* o responde a su mensaje con *.kick*"
      },
      { quoted: msg }
    );
    return;
  }

  const resultados = [];
  const mentionsOut = [];

  for (const d of targetDigits) {
    if (d === senderNum) {
      resultados.push(`⚠️ No puedes expulsarte a ti mismo (@${d}).`);
      continue;
    }
    if (d === botNum) {
      resultados.push(`⚠️ No puedo expulsarme a mí (@${d}).`);
      continue;
    }

    const targetP = findParticipantByDigits(participantes, d);
    if (!targetP) {
      resultados.push(`❌ *No encontré al usuario @${d} en este grupo.*`);
      continue;
    }

    const targetGroupId = targetP.id || targetP.jid;
    const isTargetAdmin =
      targetP.admin === "admin" || targetP.admin === "superadmin";
    const isTargetOwner =
      Array.isArray(owners) && owners.some(([id]) => id === d);

    if (isTargetAdmin || isTargetOwner) {
      resultados.push(`⚠️ *No se puede expulsar a @${d} (admin/owner).*`);
      continue;
    }

    try {
      await conn.groupParticipantsUpdate(
        chatId,
        [targetGroupId],
        "remove"
      );
      resultados.push(`✅ *Usuario @${d} expulsado.*`);
      mentionsOut.push(targetGroupId);
    } catch (err) {
      console.error("[kick] remove error:", err);
      resultados.push(`❌ *Error al expulsar a @${d}.*`);
      mentionsOut.push(targetGroupId);
    }
  }

  await conn.sendMessage(
    chatId,
    {
      text: resultados.join("\n"),
      mentions: mentionsOut
    },
    { quoted: msg }
  );

  await conn
    .sendMessage(chatId, { react: { text: "👢", key: msg.key } })
    .catch(() => {});
};

handler.command = ["kick"];
export default handler;