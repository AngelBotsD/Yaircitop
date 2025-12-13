let cachedImg
let cachedFKontak

const safeRegex = /\b(menu|buy|qr|code|p)\b/i

async function getFKontak() {
  if (cachedFKontak) return cachedFKontak

  if (!cachedImg) {
    try {
      const res = await fetch('https://files.catbox.moe/igdrbi.jpg')
      cachedImg = Buffer.from(await res.arrayBuffer())
    } catch {
      cachedImg = Buffer.alloc(0)
    }
  }

  cachedFKontak = {
    key: {
      fromMe: false,
      participant: '0@s.whatsapp.net'
    },
    message: {
      productMessage: {
        product: {
          productImage: { jpegThumbnail: cachedImg },
          title: 'texto',
          description: '𝗗𝗘𝗧𝗘𝗡𝗧𝗘 𝗔𝗩𝗜𝗦𝗢',
          currencyCode: 'USD',
          priceAmount1000: '5000',
          retailerId: 'BOT'
        },
        businessOwnerJid: '0@s.whatsapp.net'
      }
    }
  }

  return cachedFKontak
}

export async function before(m, { conn, isOwner, isROwner }) {
  if (!m.message) return true
  if (m.isBaileys || m.fromMe) return true
  if (m.isGroup) return false
  if (!m.text) return true
  if (safeRegex.test(m.text)) return true

  const chat = global.db.data.chats[m.chat]
  const bot = global.db.data.settings[conn.user.jid] || {}

  if (!bot.antiPrivate) return false
  if (isOwner || isROwner) return false

  const fkontak = await getFKontak()

  await conn.reply(
    m.chat,
    `⚠️ Hola @${m.sender.split('@')[0]}

Los comandos no funcionan en *privado*.
Serás *bloqueado automáticamente*.`,
    fkontak,
    { mentions: [m.sender] }
  )

  await conn.updateBlockStatus(m.chat, 'block')
  return false
}