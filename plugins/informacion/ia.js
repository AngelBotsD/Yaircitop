import fetch from 'node-fetch'
import axios from 'axios'

let handler = async (m, { conn, usedPrefix, command }) => {

  await m.react('🔥')

  const img = 'https://delirius-apiofc.vercel.app/nsfw/girls'

  await conn.sendMessage(m.chat, {
    image: { url: img },
    caption: '',
    buttons: [
      {
        buttonId: `${usedPrefix + command}`,
        buttonText: { displayText: '🔁 Siguiente' },
        type: 1
      }
    ],
    headerType: 4
  }, { quoted: m })

  await m.react('🔥')
}

handler.command = ['pack']
export default handler