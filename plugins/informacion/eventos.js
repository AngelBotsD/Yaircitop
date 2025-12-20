import { default as WAMessageStubType } from global.baileys

export async function before(m, { conn, participants }) {
  if (!m.isGroup) return

  const usuario = `@${m.sender.split('@')[0]}`
  const groupAdmins = participants.filter(p => p.admin).map(v => v.id)

  const fkontak = {
    key: { participants: "0@s.whatsapp.net", remoteJid: "status@broadcast", fromMe: false, id: "Halo" },
    message: {
      contactMessage: {
        vcard: `BEGIN:VCARD\nVERSION:3.0\nN:Sy;Bot;;;\nFN:y\nitem1.TEL;waid=${m.sender.split('@')[0]}:${m.sender.split('@')[0]}\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
      }
    },
    participant: "0@s.whatsapp.net"
  }

  const sendEvent = async (text, mentions = [m.sender]) => {
    await conn.sendMessage(m.chat, { text, mentions }, { quoted: fkontak, ephemeralExpiration: 24 * 60 * 100, disappearingMessagesInChat: 24 * 60 * 100 })
  }

  if (m.messageStubType) {
    switch (m.messageStubType) {
      case 21:
        await sendEvent(`${usuario} \`𝐇𝐀 𝐂𝐀𝐌𝐁𝐈𝐀𝐃𝐎 𝐄𝐋 𝐍𝐎𝐌𝐁𝐑𝐄 𝐃𝐄𝐋 𝐆𝐑𝐔𝐏𝐎 𝐀:\`\n\n> *${m.messageStubParameters[0]}*`, [m.sender, ...groupAdmins])
        break
      case 22:
        await sendEvent(`🫵 𝙇𝘼 𝙁𝙊𝙏𝙊 𝘿𝙀𝐋 𝐆𝐑𝐔𝐏𝐎 𝐀𝐇 𝙎𝙄𝐃𝐎 𝘼𝐂𝐓𝐔𝐀𝐋𝐈𝐙𝐀𝐃𝐀 𝐏𝐎𝐑: ${usuario}`, [m.sender])
        break
      case 24:
        await sendEvent(`🫵 𝙇𝘼 𝘿𝙀𝙎𝘾𝙍𝙄𝙋𝘾𝙄𝙊𝙉 𝐀𝐇 𝙎𝙄𝐃𝐎 𝙈𝙊𝘿𝐈𝐅𝐈𝐂𝐀𝐃𝐀 𝐏𝐎𝐑: ${usuario}`, [m.sender])
        break
      case 25:
        await sendEvent(`📌 𝐀𝐇𝐎𝐑𝐀 *${m.messageStubParameters[0] === 'on' ? '𝐒𝐎𝐋𝐎 𝐀𝐃𝐌𝐈𝐍𝐒' : '𝐓𝐎𝐃𝐎𝐒'}* 𝐏𝐔𝐄𝐃𝐄𝐍 𝐄𝐃𝐈𝐓𝐀𝐑 𝐋𝐀 𝐈𝐍𝐅𝐎𝐑𝐌𝐀𝐂𝐈𝐎́𝐍 𝐃𝐄𝐋 𝐆𝐑𝐔𝐏𝐎`, [m.sender])
        break
      case 26:
        await sendEvent(`𝐆𝐑𝐔𝐏𝐎 *${m.messageStubParameters[0] === 'on' ? '𝐂𝐄𝐑𝐑𝐀𝐃𝐎 🔒' : '𝐀𝐁𝐈𝐄𝐑𝐓𝐎 🔓'}*\n${m.messageStubParameters[0] === 'on' ? '𝐒𝐎𝐋𝐎 𝐀𝐃𝐌𝐈𝐍𝐒 𝐏𝐔𝐄𝐃𝐄𝐍 𝐄𝐒𝐂𝐑𝐈𝐁𝐈𝐑' : '𝐘𝐀 𝐓𝐎𝐃𝐎𝐒 𝐏𝐔𝐄𝐃𝐄𝐍 𝐄𝐒𝐂𝐑𝐈𝐁𝐈𝐑'} 𝐄𝐍 𝐄𝐒𝐓𝐄 𝐆𝐑𝐔𝐏𝐎`, [m.sender])
        break
      case 72:
        await sendEvent(`${usuario} 𝐂𝐀𝐌𝐁𝐈𝐎 𝐋𝐀 𝐃𝐔𝐑𝐀𝐂𝐈𝐎́𝐍 𝐃𝐄 𝐋𝐎𝐒 𝐌𝐄𝐍𝐒𝐀𝐉𝐄𝐒 𝐓𝐄𝐌𝐏𝐎𝐑𝐀𝐋𝐄𝐒 𝐀 @${m.messageStubParameters[0]}*`, [m.sender])
        break
      case 123:
        await sendEvent(`${usuario} 𝐃𝐄𝐒𝐀𝐂𝐓𝐈𝐕𝐎 𝐋𝐎𝐒 𝐌𝐄𝐍𝐒𝐀𝐉𝐄𝐒 𝐓𝐄𝐌𝐏𝐎𝐑𝐀𝐋𝐄𝐒`, [m.sender])
        break
    }
  }

  if (m.action && Array.isArray(m.participants)) {
    const { participants: changed, action } = m
    for (const p of changed) {
      const userTag = `@${p.split('@')[0]}`
      if (action === 'promote') {
        await sendEvent(`${userTag} 𝘼𝐇𝐎𝐑𝐀 𝐄𝐒 𝐀𝐃𝐌𝐈𝐍 𝐄𝐍 𝐄𝐒𝐓𝐄 𝐆𝐑𝐔𝐏𝐎\n🫵 𝐀𝐂𝐂𝐈𝐎𝐍 𝐑𝐄𝐀𝐋𝐈𝐙𝐀𝐃𝐀 𝐏𝐎𝐑: ${usuario}`, [usuario, p, ...groupAdmins])
      }
      if (action === 'demote') {
        await sendEvent(`${userTag} 𝐃𝐄𝐉𝐀 𝐃𝐄 𝐒𝐄𝐑 𝐀𝐃𝐌𝐈𝐍 𝐄𝐍 𝐄𝐒𝐓𝐄 𝐆𝐑𝐔𝐏𝐎\n🫵 𝐀𝐂𝐂𝐈𝐎𝐍 𝐑𝐄𝐀𝐋𝐈𝐙𝐀𝐃𝐀 𝐏𝐎𝐑: ${usuario}`, [usuario, p, ...groupAdmins])
      }
    }
  }
}