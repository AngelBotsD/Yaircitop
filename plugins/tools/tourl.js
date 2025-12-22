import fs from 'fs'
import fetch from 'node-fetch'
import FormData from 'form-data'
import { fileTypeFromBuffer } from 'file-type'
import crypto from "crypto"
import axios from 'axios'
import cheerio from 'cheerio'

function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const sizes = ['B','KB','MB','GB','TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / (1024 ** i)).toFixed(2)} ${sizes[i]}`
}

let handler = async (m, { conn, args, usedPrefix, command }) => {
  try {
    const aliases = {
      ct: 'catbox',
      pi: 'postimages',
      lt: 'litterbox',
      tf: 'tmpfiles',
      cg: 'cloudguru'
    }
const aliasesText = Object.entries(aliases)
  .map(([key, value]) => `${key} → ${value}`)
  .join('\n');
    const q = m.quoted || m
    const mime = q.mediaType || ''
    if (!/image|video|audio|sticker|document/.test(mime)) {
      return conn.reply(m.chat, `🕒\n Responde a una imagen / vídeo / audio / documento\n\nEjemplo:\n${usedPrefix + command} catbox\n\n${aliasesText}`, m,)
    }

    const mediaPath = await q.download(true)
    const sizeBytes = fs.statSync(mediaPath).size
    const humanSize = formatBytes(sizeBytes)

    if (sizeBytes === 0) {
      await conn.reply(m.chat, ' El archivo es demasiado ligero', m, rcanal)
      try { await fs.promises.unlink(mediaPath) } catch {}
      return
    }
    if (sizeBytes > 1024 * 1024 * 1024) {
      await conn.reply(m.chat, ' El archivo supera 1GB', m,)
      try { await fs.promises.unlink(mediaPath) } catch {}
      return
    }

    const services = {
      catbox:     { name: 'Catbox',     url: 'https://catbox.moe/user/api.php', field: 'fileToUpload', extra: { reqtype: 'fileupload' }, expires: 'Permanente' },
      postimages: { name: 'PostImages', url: 'https://postimages.org/json/rr',  field: 'file', extra: { optsize: '0', expire: '0', numfiles: '1' }, expires: 'Permanente' },
      litterbox:  { name: 'Litterbox',  url: 'https://api.alvianuxio.eu.org/uploader/litterbox', field: 'file', extra: { time: '24h' }, expires: '24h' },
      tmpfiles:   { name: 'TmpFiles',   url: 'https://api.alvianuxio.eu.org/uploader/tmpfiles', field: 'file', extra: {}, expires: 'Desconocido' },
      cloudguru:  { name: 'CloudGuru',  url: 'https://cloudkuimages.guru/upload.php', field: 'file', extra: {}, expires: 'Permanente' }
    }


   /* const aliases = {
      ct: 'catbox',
      pi: 'postimages',
      lt: 'litterbox',
      tf: 'tmpfiles',
      cg: 'cloudguru'
    }*/

    const choice = (args[0] || '').toLowerCase()
    const serviceKey = services[choice] ? choice : (aliases[choice] ? aliases[choice] : null)

    if (!serviceKey) {
      let helpText = `❓ Servicios disponibles:\n\n`
      Object.keys(services).forEach(k => {
        helpText += `• ${k} (${services[k].name})\n`
      })
      helpText += `\nEjemplo:\n${usedPrefix + command} catbox\n${usedPrefix + command} pi

${aliases}`
      await conn.reply(m.chat, helpText, m)
      try { await fs.promises.unlink(mediaPath) } catch {}
      return
    }

    let svc = services[serviceKey]
    let link = await uploadService(svc, mediaPath)

    try { await fs.promises.unlink(mediaPath) } catch {}

    let txt = `乂 *${svc.name.toUpperCase()}*\n\n`
    txt += `• Enlace: ${link}\n`
    txt += `• Tamaño: ${humanSize}\n`
    txt += `• Expiración: ${svc.expires}\n`

    await conn.reply(m.chat, txt.trim(), m)

  } catch (e) {
    await conn.reply(m.chat, '❗ ' + e.message, m)
  }
}

handler.help = ['tourl <servicio>']
handler.tags = ['tools']
handler.command = /^(catbox|ct|url)$/i
handler.owner = false
export default handler

async function uploadService(svc, path) {
  try {
    const buffer = await fs.promises.readFile(path)
    const { ext, mime } = await fileTypeFromBuffer(buffer) || {}
    const fileName = `upload.${ext || 'bin'}`
    const form = new FormData()

    for (const [k, v] of Object.entries(svc.extra)) {
      form.append(k, v)
    }


    if (svc.url.includes('postimages.org')) {
      const data = new FormData()
      data.append('optsize', '0')
      data.append('expire', '0')
      data.append('numfiles', '1')
      data.append('upload_session', Math.random())
      data.append('file', buffer, `${Date.now()}.jpg`)
      const res = await axios.post('https://postimages.org/json/rr', data)
      const html = await axios.get(res.data.url)
      const $ = cheerio.load(html.data)
      const image = $('#code_direct').attr('value')
      if (!image) throw new Error('No se pudo obtener la URL directa')
      return image
    }


    if (svc.url.includes('catbox.moe')) {
      const formData = new FormData()
      formData.append('reqtype', 'fileupload')
      const randomBytes = crypto.randomBytes(5).toString("hex")
      const fileExt = ext || 'bin'
      formData.append('fileToUpload', buffer, {
        filename: `${randomBytes}.${fileExt}`,
        contentType: mime || 'application/octet-stream'
      })
      const res = await axios.post(svc.url, formData, {
        headers: formData.getHeaders(),
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      })
      return res.data
    }


    form.append(svc.field, buffer, { filename: fileName, contentType: mime || 'application/octet-stream' })
    const res = await fetch(svc.url, { method: 'POST', headers: form.getHeaders(), body: form })
    const json = await res.json()
    let url = json.data?.url || json.url || json.src || (Array.isArray(json) ? json[0]?.url || json[0]?.src : null)
    if (!url) throw new Error('No URL en respuesta: ' + JSON.stringify(json))
    return url

  } catch (err) {
    console.error(`Error al subir a ${svc.name}:`, err)
    throw err
  }
}