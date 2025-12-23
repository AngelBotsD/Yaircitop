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
const DIGITS = (s = "") => String(s).replace(/\D/g, "")

function lidParser(participants = []) {
  try {
    return participants.map(v => ({
      id: (typeof v?.id === "string" && v.id.endsWith("@lid") && v.jid) ? v.jid : v.id,
      admin: v?.admin ?? null,
      raw: v
    }))
  } catch {
    return participants || []
  }
}

export async function handler(chatUpdate) {
this.msgqueque = this.msgqueque || []
this.uptime = this.uptime || Date.now()
if (!chatUpdate) return
this.pushMessage(chatUpdate.messages).catch(console.error)
let m = chatUpdate.messages[chatUpdate.messages.length - 1]
if (!m) return
if (global.db.data == null)
await global.loadDatabase()
try {
m = smsg(this, m) || m
if (!m) return
m.exp = 0
} catch (e) {
console.error(e)
}

if (typeof m.text !== "string") m.text = ""

try {
const user = global.db.data.users[m.sender]
if (typeof user !== "object") global.db.data.users[m.sender] = {}
if (user) {
if (!("name" in user)) user.name = m.name
if (!("exp" in user) || !isNumber(user.exp)) user.exp = 0
if (!("coin" in user) || !isNumber(user.coin)) user.coin = 0
if (!("bank" in user) || !isNumber(user.bank)) user.bank = 0
if (!("level" in user) || !isNumber(user.level)) user.level = 0
if (!("health" in user) || !isNumber(user.health)) user.health = 100
if (!("genre" in user)) user.genre = ""
if (!("birth" in user)) user.birth = ""
if (!("marry" in user)) user.marry = ""
if (!("description" in user)) user.description = ""
if (!("packstickers" in user)) user.packstickers = null
if (!("premium" in user)) user.premium = false
if (!("premiumTime" in user)) user.premiumTime = 0
if (!("banned" in user)) user.banned = false
if (!("bannedReason" in user)) user.bannedReason = ""
if (!("commands" in user) || !isNumber(user.commands)) user.commands = 0
if (!("afk" in user) || !isNumber(user.afk)) user.afk = -1
if (!("afkReason" in user)) user.afkReason = ""
if (!("warn" in user) || !isNumber(user.warn)) user.warn = 0
} else global.db.data.users[m.sender] = {
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

const chat = global.db.data.chats[m.chat]
if (typeof chat !== "object") global.db.data.chats[m.chat] = {}
if (chat) {
if (!("isBanned" in chat)) chat.isBanned = false
if (!("isMute" in chat)) chat.isMute = false
if (!("welcome" in chat)) chat.welcome = false
if (!("sWelcome" in chat)) chat.sWelcome = ""
if (!("sBye" in chat)) chat.sBye = ""
if (!("detect" in chat)) chat.detect = true
if (!("primaryBot" in chat)) chat.primaryBot = null
if (!("modoadmin" in chat)) chat.modoadmin = false
if (!("antiLink" in chat)) chat.antiLink = true
if (!("nsfw" in chat)) chat.nsfw = false
if (!("economy" in chat)) chat.economy = true
if (!("gacha" in chat)) chat.gacha = true
} else global.db.data.chats[m.chat] = {
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

const settings = global.db.data.settings[this.user.jid]
if (typeof settings !== "object") global.db.data.settings[this.user.jid] = {}
if (settings) {
if (!("self" in settings)) settings.self = false
if (!("restrict" in settings)) settings.restrict = true
if (!("jadibotmd" in settings)) settings.jadibotmd = true
if (!("antiPrivate" in settings)) settings.antiPrivate = false
if (!("gponly" in settings)) settings.gponly = false
} else global.db.data.settings[this.user.jid] = {
self: false,
restrict: true,
jadibotmd: true,
antiPrivate: false,
gponly: false
}
} catch (e) {
console.error(e)
}

const user = global.db.data.users[m.sender]
try {
const nuevo = m.pushName || await this.getName(m.sender)
if (typeof nuevo === "string" && nuevo.trim() && nuevo !== user.name) user.name = nuevo
} catch {}

const chat = global.db.data.chats[m.chat]
const settings = global.db.data.settings[this.user.jid]

const senderDigits = DIGITS(m.sender)
const isROwner = global.owner.map(v => DIGITS(v)).includes(senderDigits)
const isOwner = isROwner || m.fromMe
const isPrems = isROwner || global.prems.map(v => DIGITS(v)).includes(senderDigits) || user.premium

if (settings.self && !isOwner) return
if (settings.gponly && !isOwner && !m.chat.endsWith("g.us") && !/code|p|ping|qr|estado|status|infobot|botinfo|report|reportar|invite|join|logout|suggest|help|menu/gim.test(m.text)) return

let groupMetadata = {}
let participants = []
let userGroup = {}
let botGroup = {}
let isRAdmin = false
let isAdmin = false
let isBotAdmin = false

if (m.isGroup) {
try {
groupMetadata = await this.groupMetadata(m.chat)
const raw = groupMetadata.participants || []
const norm = lidParser(raw)
participants = raw

const find = d => norm.find(p => DIGITS(p.id || "") === d || DIGITS(p.raw?.id || "") === d)
const u = find(senderDigits)
const b = find(DIGITS(this.user.jid))

isRAdmin = u?.admin === "superadmin" || DIGITS(groupMetadata.owner || "") === senderDigits
isAdmin = isRAdmin || u?.admin === "admin"
isBotAdmin = b?.admin === "admin" || b?.admin === "superadmin"

userGroup = u || {}
botGroup = b || {}
} catch (e) {
console.error(e)
}
}

if (m.isBaileys) return
m.exp += Math.ceil(Math.random() * 10)

const ___dirname = path.join(path.dirname(fileURLToPath(import.meta.url)), "plugins")

for (const name in global.plugins) {
const plugin = global.plugins[name]
if (!plugin || plugin.disabled) continue
const __filename = join(___dirname, name)

if (typeof plugin.all === "function") {
try {
await plugin.all.call(this, m, { chatUpdate, __dirname: ___dirname, __filename, user, chat, settings })
} catch (e) {
console.error(e)
}
}

const pluginPrefix = plugin.customPrefix || global.prefix
if (!m.text.startsWith(pluginPrefix)) continue
const noPrefix = m.text.slice(pluginPrefix.length).trim()
const [command, ...args] = noPrefix.split(/\s+/)
const isAccept = Array.isArray(plugin.command) ? plugin.command.includes(command) : plugin.command === command
if (!isAccept) continue

const fail = plugin.fail || global.dfail
if (plugin.rowner && !isROwner) return fail("rowner", m, this)
if (plugin.owner && !isOwner) return fail("owner", m, this)
if (plugin.premium && !isPrems) return fail("premium", m, this)
if (plugin.group && !m.isGroup) return fail("group", m, this)
if (plugin.botAdmin && !isBotAdmin) return fail("botAdmin", m, this)
if (plugin.admin && !isAdmin) return fail("admin", m, this)
if (plugin.private && m.isGroup) return fail("private", m, this)

m.isCommand = true
user.commands++

await plugin.call(this, m, {
conn: this,
command,
args,
text: args.join(" "),
participants,
groupMetadata,
userGroup,
botGroup,
isROwner,
isOwner,
isAdmin,
isBotAdmin,
isPrems,
chat,
user,
settings,
__dirname: ___dirname,
__filename
})
}

user.exp += m.exp

try {
if (!opts["noprint"]) await (await import("./lib/print.js")).default(m, this)
} catch {}
}

global.dfail = (type, m, conn) => {
const msg = {
rowner: `*𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈 𝖲𝗈𝗅𝗈 𝖯𝗎𝖾𝖽𝖾 𝖲𝖾𝗋 𝖴𝗌𝖺𝖽𝗈 𝖯𝗈𝗋 𝖬𝗂 𝖢𝗋𝖾𝖺𝖽𝗈𝗋*`,
owner: `*𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝖽𝗈 𝖲𝗈𝗅𝗈 𝖯𝗎𝖾𝖽𝖾 𝖲𝖾𝗋 𝖴𝗍𝗂𝗅𝗂𝗓𝖺𝖽𝗈 𝖯𝗈𝗋 𝖬𝗂 𝖢𝗋𝖾𝖺𝖽𝗈𝗋*`,
mods: `*𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈 𝖲𝗈𝗅𝗈 𝖯𝗎𝖾𝖽𝖾 𝖲𝖾𝗋 𝖴𝗍𝗂𝗅𝗂𝗓𝖺𝖽𝗈 𝖯𝗈𝗋 𝖽𝖾𝗌𝖺𝗋𝗋𝗈𝗅𝗅𝖺𝖽𝗈𝗋𝖾𝗌 𝖮𝖿𝗂𝖼𝗂𝖺𝗅𝖾𝗌*`,
premium: `*𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈 𝖲𝗈𝗅𝗈 𝖫𝗈 𝖯𝗎𝖾𝖽𝖾𝗇 𝖴𝗍𝗂𝗅𝗂𝗓𝖺𝗋 𝖴𝗌𝖺𝗋𝗂𝗈𝗌 𝖯𝗋𝖾𝗆𝗂𝗎𝗆*`,
group: `*𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈 𝖲𝗈𝗅𝗈 𝖥𝗎𝗇𝖼𝗂𝗈𝗇𝖺 𝖤𝗇 𝖦𝗋𝗎𝗉𝗈𝗌*`,
private: `*𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈 𝖲𝗈𝗅𝗈 𝖲𝖾 𝖯𝗎𝖾𝖽𝖾 𝖮𝖼𝗎𝗉𝖺𝗋 𝖤𝗇 𝖤𝗅 𝖯𝗋𝗂𝗏𝖺𝖽𝗈 𝖣𝖾𝗅 𝖡𝗈𝗍*`,
admin: `*𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈 𝖲𝗈𝗅𝗈 𝖯𝗎𝖾𝖽𝖾 𝖲𝖾𝗋 𝖴𝗌𝖺𝖽𝗈 𝖯𝗈𝗋 𝖠𝖽𝗆𝗂𝗇𝗂𝗌𝗍𝗋𝖺𝖽𝗈𝗋𝖾𝗌*`,
botAdmin: `*𝖭𝖾𝖼𝖾𝗌𝗂𝗍𝗈 𝗌𝖾𝗋 𝖠𝖽𝗆𝗂𝗇 𝖯𝖺𝗋𝖺 𝖴𝗌𝖺𝗋 𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈*`,
unreg: `*𝖭𝗈 𝖤𝗌𝗍𝖺𝗌 𝖱𝖾𝗀𝗂𝗌𝗍𝗋𝖺𝖽𝗈, 𝖴𝗌𝖺 .𝗋𝖾𝗀 (𝗇𝖺𝗆𝖾) 19*`,
restrict: `*𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈 𝖠𝗁 𝖲𝗂𝖽𝗈 𝖣𝖾𝗌𝖺𝖻𝗂𝗅𝗂𝗍𝖺𝖽𝗈 𝖯𝗈𝗋 𝖬𝗂 𝖢𝗋𝖾𝖺𝖽𝗈𝗋*`
}[type]
if (msg) return conn.reply(m.chat, msg, m, rcanal).then(_ => m.react("✖️"))
}

let file = global.__filename(import.meta.url, true)
watchFile(file, async () => {
unwatchFile(file)
console.log(chalk.magenta("Se actualizo 'handler.js'"))
if (global.reloadHandler) console.log(await global.reloadHandler())
})