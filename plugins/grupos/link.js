import fetch from 'node-fetch'

const safeFetch = async (url, timeout = 5000) => {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(url, { signal: controller.signal })
    return res.ok ? Buffer.from(await res.arrayBuffer()) : null
  } catch {
    return null
  } finally {
    clearTimeout(id)
  }
}

async function handler(m, { conn }) {
  const chat = m.chat

  await conn.sendMessage(chat, {
    react: { text: '🔗', key: m.key }
  })

  const code = await conn.groupInviteCode(chat).catch(() => null)
  const link = code
    ? `https://chat.whatsapp.com/${code}`
    : 'Sin enlace disponible'

  const fallback = 'https://files.catbox.moe/xr2m6u.jpg'
  let thumb = null

  try {
    const ppUrl = await conn.profilePictureUrl(chat, 'image').catch(() => null)
    if (ppUrl && ppUrl !== 'not-authorized' && ppUrl !== 'not-exist') {
      thumb = await safeFetch(ppUrl, 6000)
    }
  } catch {}

  if (!thumb) {
    thumb = await safeFetch(fallback)
  }

  await conn.sendMessage(chat, {
    text: link,
    contextInfo: {
      externalAdReply: {
        title: '🔗 LINK DEL GRUPO',
        body: 'Toca para unirte',
        thumbnail: thumb,
        sourceUrl: link,
        mediaType: 1,
        renderLargerThumbnail: true,
        showAdAttribution: false
      }
    }
  }, { quoted: m })
}

handler.command = ['link']
handler.group = true
handler.botAdmin = true

export default handler