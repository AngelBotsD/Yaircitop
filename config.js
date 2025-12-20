import { watchFile, unwatchFile } from 'fs'
import chalk from 'chalk'
import { fileURLToPath } from 'url'

global.owner = [
'159606034665538',
'205819731832938',
'226044783132714',
'217158512549931',
'',
''
]
global.emoji = '📎'
global.emoji2 = '🏞️'
global.namebot = '𝖠𝗇𝗀𝖾𝗅 𝖡𝗈𝗍'
global.botname = '𝖠𝗇𝗀𝖾𝗅 𝖡𝗈𝗍'
global.banner = 'https://files.catbox.moe/igdrbi.jpg'
global.packname = '𝖠𝗇𝗀𝖾𝗅 𝖡𝗈𝗍'
global.author = '𝖣𝖾𝗌𝖺𝗋𝗅𝗅𝖺𝖽𝗈 𝗉𝗈𝗋 𝖠𝗇𝗀𝖾𝗅'
global.sessions = '𝖠𝗇𝗀𝖾𝗅𝖡𝗈𝗍'

global.APIs = {
sky: 'https://api-sky.ultraplus.click',
may: 'https://mayapi.ooguy.com'
}

global.APIKeys = {
sky: 'Angxlllll',
may: 'may-0595dca2'
}

const file = fileURLToPath(import.meta.url)
watchFile(file, () => {
unwatchFile(file)
console.log(chalk.redBright("Se actualizó el 'config.js'"))
import(`file://${file}?update=${Date.now()}`)
})