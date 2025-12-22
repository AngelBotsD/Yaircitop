import { smsg } from "./lib/simple.js"
import { format } from "util"
import { fileURLToPath } from "url"
import path, { join } from "path"
import fs, { unwatchFile, watchFile } from "fs"
import chalk from "chalk"
import fetch from "node-fetch"
import ws from "ws"

const isNumber = x => typeof x === "number" && !isNaN(x)
const delay = ms => isNumber(ms) && new Promise(resolve => setTimeout(resolve, ms))
const normalize = jid => jid?.replace(/[^0-9]/g, "") + "@s.whatsapp.net" // <--- CAMBIO

export async function handler(chatUpdate) {
this.msgqueque = this.msgqueque || []
this.uptime = this.uptime || Date.now()
if (!chatUpdate) return
this.pushMessage(chatUpdate.messages).catch(console.error)
let m = chatUpdate.messages[chatUpdate.messages.length - 1]
if (!m) return
if (global.db.data == null) await global.loadDatabase()

try {
m = smsg(this, m) || m
if (!m) return
m.exp = 0

if (typeof m.text !== "string") m.text = ""

/* ================= STICKER → COMANDO ================= */
try {
const st = m.message?.stickerMessage ||
m.message?.ephemeralMessage?.message?.stickerMessage
if (st) {
const jsonPath = "./comandos.json"
if (!fs.existsSync(jsonPath)) fs.writeFileSync(jsonPath, "{}")
const map = JSON.parse(fs.readFileSync(jsonPath))

const raw = st.fileSha256
let key = Buffer.isBuffer(raw) ? raw.toString("base64") : null
if (key && map[key]) {
const pref = Array.isArray(global.prefixes) ? global.prefixes[0] : "."
m.text = (map[key].startsWith(pref) ? map[key] : pref + map[key]).toLowerCase()
}
}
} catch {}

/* ================= DATABASE ================= */
const user = global.db.data.users[m.sender] ||= {
name: m.name,
exp: 0,
coin: 0,
bank: 0,
level: 0,
health: 100,
genre: "",
birth: "",
marry: "",
description: "",
packstickers: null,
premium: false,
premiumTime: 0,
banned: false,
bannedReason: "",
commands: 0,
afk: -1,
afkReason: "",
warn: 0
}

const chat = global.db.data.chats[m.chat] ||= {
isBanned: false,
isMute: false,
welcome: false,
sWelcome: "",
sBye: "",
detect: true,
primaryBot: null,
modoadmin: false,
antiLink: true,
nsfw: false,
economy: true,
gacha: true
}

const settings = global.db.data.settings[this.user.jid] ||= {
self: false,
restrict: true,
jadibotmd: true,
antiPrivate: false,
gponly: false
}

/* ================= ROLES ================= */
const isROwner = global.owner.map(v => normalize(v)).includes(m.sender) // <--- CAMBIO
const isOwner = isROwner || m.fromMe
const isPrems =
isROwner ||
global.prems?.map(v => normalize(v)).includes(m.sender) || // <--- CAMBIO
user.premium

if (settings.self && !isOwner) return

/* ================= GROUP ================= */
let groupMetadata = {}
let participants = []
let isRAdmin = false
let isAdmin = false
let isBotAdmin = false
let userGroup = {}
let botGroup = {}

if (m.isGroup) {
groupMetadata = await this.groupMetadata(m.chat).catch(() => ({}))
participants = groupMetadata.participants || []

const u = participants.find(p => p.id === m.sender) // <--- CAMBIO
const b = participants.find(p => p.id === this.user.jid) // <--- CAMBIO

isRAdmin = u?.admin === "superadmin" || m.sender === groupMetadata.owner
isAdmin = isRAdmin || u?.admin === "admin"
isBotAdmin = b?.admin === "admin" || b?.admin === "superadmin"

userGroup = u || {}
botGroup = b || {}
}

/* ================= PLUGINS ================= */
const ___dirname = path.join(path.dirname(fileURLToPath(import.meta.url)), "plugins")

for (const name in global.plugins) {
const plugin = global.plugins[name]
if (!plugin || plugin.disabled) continue
const __filename = join(___dirname, name)

/* ALL */
if (typeof plugin.all === "function") {
await plugin.all.call(this, m, {
chatUpdate,
__dirname: ___dirname,
__filename,
user,
chat,
settings
})
}

/* PREFIX */
const strRegex = str => str.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&")
const pluginPrefix = plugin.customPrefix || global.prefix // <--- CAMBIO: eliminar conn.prefix
const match = (pluginPrefix instanceof RegExp ?
[[pluginPrefix.exec(m.text), pluginPrefix]] :
Array.isArray(pluginPrefix) ?
pluginPrefix.map(p => [new RegExp(strRegex(p)).exec(m.text), p]) :
[[new RegExp(strRegex(pluginPrefix)).exec(m.text), pluginPrefix]]
).find(p => p[0])

if (!match) continue
const usedPrefix = match[1]
const noPrefix = m.text.replace(usedPrefix, "").trim()
let [command, ...args] = noPrefix.split(/\s+/)
command = command?.toLowerCase()
const text = args.join(" ")

const isAccept = plugin.command instanceof RegExp ?
plugin.command.test(command) :
Array.isArray(plugin.command) ?
plugin.command.includes(command) :
plugin.command === command

if (!isAccept) continue

/* PERMISOS */
const fail = plugin.fail || global.dfail
if (plugin.rowner && !isROwner) return fail("rowner", m, this)
if (plugin.owner && !isOwner) return fail("owner", m, this)
if (plugin.premium && !isPrems) return fail("premium", m, this)
if (plugin.group && !m.isGroup) return fail("group", m, this)
if (plugin.admin && !isAdmin) return fail("admin", m, this)
if (plugin.botAdmin && !isBotAdmin) return fail("botAdmin", m, this)

m.isCommand = true
user.commands++

await plugin.call(this, m, {
usedPrefix,
command,
args,
text,
conn: this,
participants,
groupMetadata,
userGroup,
botGroup,
isROwner,
isOwner,
isAdmin,
isBotAdmin,
isPrems,
chatUpdate,
__dirname: ___dirname,
__filename,
user,
chat,
settings
})
}

user.exp += m.exp
if (!opts["noprint"]) {
await (await import("./lib/print.js")).default(m, this)
}

} catch (e) {
console.error(e)
}
}

/* ================= DFAIL ================= */
global.dfail = (type, m, conn) => {
const msg = {
rowner: "*𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈 𝖲𝗈𝗅𝗈 𝖯𝗎𝖾𝖽𝖾 𝖲𝖾𝗋 𝖴𝗌𝖺𝖽𝗈 𝖯𝗈𝗋 𝖬𝗂 𝖢𝗋𝖾𝖺𝖽𝗈𝗋*",
owner: "*𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈 𝖲𝗈𝗅𝗈 𝖯𝗎𝖾𝖽𝖾 𝖲𝖾𝗋 𝖴𝗍𝗂𝗅𝗂𝗓𝖺𝗱𝗈 𝖯𝗈𝗋 𝖬𝗂 𝖢𝗋𝖾𝖺𝖽𝗈𝗋*",
premium: "*𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈 𝖲𝗈𝗅𝗈 𝖫𝗈 𝖯𝗎𝖾𝖽𝖾𝗇 𝖴𝗍𝗂𝗅𝗂𝗓𝖺𝗋 𝖴𝗌𝗎𝖺𝗋𝗂𝗈𝗌 𝖯𝗋𝖾𝗆𝗂𝗎𝗆*",
group: "*𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈 𝖲𝗈𝗅𝗈 𝖥𝗎𝗇𝖼𝗂𝗈𝗇𝖺 𝖤𝗇 𝖦𝗋𝗎𝗉𝗈𝗌*",
admin: "*𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈 𝖲𝗈𝗅𝗈 𝖯𝗎𝖾𝖽𝖾 𝖲𝖾𝗋 𝖴𝗌𝖺𝖽𝗈 𝖯𝗈𝗋 𝖠𝖽𝗆𝗂𝗇𝗂𝗌𝗍𝗋𝖺𝖽𝗈𝗋𝖾𝗌*",
botAdmin: "*𝖭𝖾𝖼𝖾𝗌𝗂𝗍𝗈 𝗌𝖾𝗋 𝖠𝖽𝗆𝗂𝗇 𝖯𝖺𝗋𝖺 𝖴𝗌𝖺𝗋 𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈*",
private: "*𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈 𝖲𝗈𝗅𝗈 𝖲𝖾 𝖯𝗎𝖾𝖽𝖾 𝖮𝖼𝗎𝗉𝖺𝗋 𝖤𝗇 𝖤𝗅 𝖯𝗋𝗂𝗏𝖺𝖽𝗈 𝖣𝖾𝗅 𝖡𝗈𝗍*"
}[type]
if (msg) return conn.reply(m.chat, msg, m, rcanal).then(_ => m.react('✖️')) // <--- RCANAL intacto
}

/* ================= WATCH ================= */
let file = global.__filename(import.meta.url, true)
watchFile(file, async () => {
unwatchFile(file)
console.log(chalk.magenta("Se actualizó handler.js"))
if (global.reloadHandler) console.log(await global.reloadHandler())
})