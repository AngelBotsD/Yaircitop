import { watchFile, unwatchFile } from 'fs'
import chalk from 'chalk'
import { fileURLToPath } from 'url'

global.owner = [
'5216184459748', 
'5714222810'
] 

global.namebot = '𝖸𝖺𝗑𝗋𝖼𝗂𝗍𝗈 𝖡𝗈𝗍'
global.botname = '𝖸𝖺𝗑𝗋𝖼𝗂𝗍𝗈 𝖡𝗈𝗍'
global.banner = 'https://files.catbox.moe/9yuy4n.jpg'
global.packname = '𝖸𝖺𝗑𝗋𝖼𝗂𝗍𝗈 𝖡𝗈𝗍'
global.author = '𝖡𝗈𝗍𝗌𝗂𝗍𝗈 𝖽𝖾 𝖸𝖺𝗑𝗋𝖼𝗂𝗍𝗈'
global.sessions = '𝖸𝖺𝗑𝗋𝖼𝗂𝗍𝗈𝖡𝗈𝗍'

global.APIs = {
may: 'https://api.soymaycol.icu'
}

global.APIKeys = {
may: 'may-e89378ce'
}

const file = fileURLToPath(import.meta.url)
watchFile(file, () => {
unwatchFile(file)
console.log(chalk.redBright("Se actualizó el 'config.js'"))
import(`file://${file}?update=${Date.now()}`)
})