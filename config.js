import { watchFile, unwatchFile } from 'fs'
import chalk from 'chalk'
import { fileURLToPath } from 'url'

global.owner = [
'159606034665538',
'245573982662762',
'274135666176172',
'217158512549931',
'226044783132714',
'25856038715509'
]

global.emoji = '📎'
global.emoji2 = '🏞️'
global.namebot = '𝖠𝗇𝗀𝖾𝗅 𝖡𝗈𝗍'
global.botname = '𝖠𝗇𝗀𝖾𝗅 𝖡𝗈𝗍'
global.banner = 'https://files.catbox.moe/igdrbi.jpg'
global.packname = '𝖠𝗇𝗀𝖾𝗅 𝖡𝗈𝗍'
global.author = '𝖣𝖾𝗌𝖺𝗋𝗋𝗈𝗅𝗅𝖺𝖽𝗈 𝗉𝗈𝗋 𝖠𝗇𝗀𝖾𝗅'
global.sessions = '𝖠𝗇𝗀𝖾𝗅𝖡𝗈𝗍'

const file = fileURLToPath(import.meta.url)
watchFile(file, () => {
  unwatchFile(file)
  console.log(chalk.redBright("Se actualizó el 'config.js'"))
  import(`file://${file}?update=${Date.now()}`)
})