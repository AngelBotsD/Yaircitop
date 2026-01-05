import yts from 'yt-search'

const MAX_SECONDS = 90 * 60
const HTTP_TIMEOUT_MS = 90 * 1000

function parseDurationToSeconds(d) {
  if (d == null) return null
  if (typeof d === 'number' && Number.isFinite(d)) return Math.max(0, Math.floor(d))
  const s = String(d).trim()
  if (!s) return null
  if (/^\d+$/.test(s)) return Math.max(0, parseInt(s, 10))
  const parts = s.split(':').map(v => v.trim()).filter(Boolean)
  if (!parts.length || parts.some(p => !/^\d+$/.test(p))) return null
  let sec = 0
  for (const p of parts) sec = sec * 60 + parseInt(p, 10)
  return Number.isFinite(sec) ? sec : null
}

async function fetchJson(url, timeoutMs = HTTP_TIMEOUT_MS) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    const txt = await res.text()
    const data = JSON.parse(txt)
    if (!res.ok) throw new Error(data?.message || 'Error API')
    return data
  } finally {
    clearTimeout(t)
  }
}

async function fetchBuffer(url, timeoutMs = HTTP_TIMEOUT_MS) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal })
    if (!res.ok) throw new Error('No se pudo descargar')
    const ab = await res.arrayBuffer()
    return Buffer.from(ab)
  } finally {
    clearTimeout(t)
  }
}

let handler = async (m, { conn, text, command, usedPrefix }) => {
  const from = m.chat
  if (!text) {
    return conn.sendMessage(from, {
      text: `「✦」Escribe el nombre de la canción o video\n> ✐ Ejemplo » *${usedPrefix + command} lovely*`
    }, { quoted: m })
  }

  await conn.sendMessage(from, { react: { text: '🕒', key: m.key } })

  const search = await yts(text)
  const video = search?.videos?.[0]
  if (!video) {
    return conn.sendMessage(from, { text: '「✦」No se encontraron resultados.' }, { quoted: m })
  }

  const durationSec = parseDurationToSeconds(video.seconds || video.timestamp)
  if (durationSec && durationSec > MAX_SECONDS) {
    return conn.sendMessage(from, {
      text: `「✦」El contenido supera el límite de duración.`
    }, { quoted: m })
  }

  const caption =
    `「✦」*${video.title}*\n\n` +
    `> ❀ Canal » *${video.author?.name || 'Desconocido'}*\n` +
    `> ⴵ Duración » *${video.timestamp}*`

  await conn.sendMessage(from, {
    image: { url: video.thumbnail },
    caption,
    buttons: [
      { buttonId: `${usedPrefix + command} audio ${video.url}`, buttonText: { displayText: '🎧 Audio' }, type: 1 },
      { buttonId: `${usedPrefix + command} video ${video.url}`, buttonText: { displayText: '🎥 Video' }, type: 1 }
    ],
    headerType: 4
  }, { quoted: m })
}

handler.before = async (m, { conn }) => {
  if (!m.text) return
  if (!m.text.startsWith('.play audio') && !m.text.startsWith('.play video')) return

  const args = m.text.split(' ')
  const type = args[1]
  const ytUrl = args.slice(2).join(' ')
  const from = m.chat

  const apikey = 'Angxlllll'

  if (type === 'audio') {
    const api = `https://api-adonix.ultraplus.click/download/ytaudio?apikey=${apikey}&url=${encodeURIComponent(ytUrl)}`
    const data = await fetchJson(api)
    const buffer = await fetchBuffer(data.data.url)

    await conn.sendMessage(from, {
      audio: buffer,
      mimetype: 'audio/mpeg',
      fileName: `${data.data.title}.mp3`
    }, { quoted: m })

    await conn.sendMessage(from, { react: { text: '✔️', key: m.key } })
  }

  if (type === 'video') {
    const api = `https://api-adonix.ultraplus.click/download/ytvideo?apikey=${apikey}&url=${encodeURIComponent(ytUrl)}`
    const data = await fetchJson(api)

    await conn.sendMessage(from, {
      video: { url: data.data.url },
      mimetype: 'video/mp4',
      fileName: `${data.data.title}.mp4`
    }, { quoted: m })

    await conn.sendMessage(from, { react: { text: '✔️', key: m.key } })
  }
}

handler.help = ['play <texto>']
handler.tags = ['multimedia']
handler.command = ['play']

export default handler