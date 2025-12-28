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

const OWNER_NUMBERS = (global.owner || []).map(v =>
  Array.isArray(v) ? DIGITS(v[0]) : DIGITS(v)
)

function isOwnerBySender(sender) {
  return OWNER_NUMBERS.includes(DIGITS(sender))
}

/* =========================
   === IA GEMINI CLIENT ===
   ========================= */

const gemini = {
getNewCookie: async () => {
const res = await fetch(
"https://gemini.google.com/_/BardChatUi/data/batchexecute?rpcids=maGuAc",
{
method: "POST",
headers: {
"content-type": "application/x-www-form-urlencoded;charset=UTF-8",
},
body: "f.req=%5B%5B%5B%22maGuAc%22%2C%22%5B0%5D%22%2Cnull%2C%22generic%22%5D%5D%5D&"
}
)

const cookie = res.headers.get("set-cookie")
if (!cookie) throw new Error("No cookie")
return cookie.split(";")[0]

},

ask: async (prompt) => {

let cookie = await gemini.getNewCookie()

const body = new URLSearchParams({
  "f.req": JSON.stringify([
    null,
    JSON.stringify([[prompt], ["en-US"], null])
  ])
})

const res = await fetch(
  "https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?hl=en-US&rt=c",
  {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
      cookie
    },
    body
  }
)

const text = await res.text()
const match = [...text.matchAll(/^\d+\n(.+?)\n/gm)]

for (const m of match.reverse()) {
  try {
    const arr = JSON.parse(m[1])
    const p = JSON.parse(arr[0][2])
    return p[4][0][1][0]
  } catch {}
}

throw new Error("No response")
}
}

/* =========================
   ===== MAIN HANDLER =====
   ========================= */

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

    if (typeof m.text !== "string") m.text = ""

    /* =========================
       ==== IA AUTOREPLY ======
       SOLO SI MENCIONAN BOT
       ========================= */

    if (m.text) {

      // obtener JID real del bot
      const botJid =
        this.user?.id?.split(':')[0] + '@s.whatsapp.net' ||
        this.user?.jid

      // context real
      const ctx =
        m?.message?.extendedTextMessage?.contextInfo ||
        m?.message?.imageMessage?.contextInfo ||
        m?.message?.videoMessage?.contextInfo ||
        m?.message?.buttonsMessage?.contextInfo ||
        m?.message?.templateButtonReplyMessage?.contextInfo ||
        {}

      // menciones
      const mentioned = ctx.mentionedJid || []

      // validar mención
      if (mentioned.includes(botJid)) {

        let text = m.text.replace(/@\S+/g, "").trim()

        if (!text) await this.reply(m.chat, "hola si", m)
        else {
          try {
            await this.sendPresenceUpdate("composing", m.chat)
            const res = await gemini.ask(text)
            await this.reply(m.chat, res, m)
          } catch (e) {
            console.error(e)
            await this.reply(m.chat, "❌ Error con la IA", m)
          }
        }
      }
    }

    /* 
       🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥
       DESDE AQUÍ SIGUE TU HANDLER ORIGINAL
       🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥🔥
    */

    // … (todo tu handler normal sin tocarlo)

    const user = global.db.data.users[m.sender] ||= {
      name: m.name,
      exp: 0,
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
nsfw: false
}

const settings = global.db.data.settings[this.user.jid] ||= {
self: false,
restrict: true,
antiPrivate: false,
gponly: false
}

const isROwner = isOwnerBySender(m.sender)
const isOwner = isROwner || m.fromMe
const isPrems = isROwner || user.premium === true
const isOwners = isROwner || m.sender === this.user.jid

if (settings.self && !isOwners) return
if (m.isBaileys) return

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
participants = groupMetadata.participants || []

const userParticipant = participants.find(p =>
p.id === m.sender || p.jid === m.sender
)

const botParticipant = participants.find(p =>
p.id === this.user.jid || p.jid === this.user.jid
)

isRAdmin =
userParticipant?.admin === "superadmin" ||
DIGITS(m.sender) === DIGITS(groupMetadata.owner)

isAdmin =
isRAdmin || userParticipant?.admin === "admin"

isBotAdmin =
botParticipant?.admin === "admin" ||
botParticipant?.admin === "superadmin"

userGroup = userParticipant || {}
botGroup = botParticipant || {}

} catch (e) {
console.error(e)
}
}

let usedPrefix = ""
const ___dirname = path.join(path.dirname(fileURLToPath(import.meta.url)), "plugins")

for (const name in global.plugins) {
const plugin = global.plugins[name]
if (!plugin) continue
if (plugin.disabled) continue

const __filename = join(___dirname, name)

try {
if (typeof plugin.all === "function") {
try {
await plugin.all.call(this, m, {
chatUpdate,
__dirname: ___dirname,
__filename,
user,
chat,
settings
})
} catch (err) {
console.error(err)
}
}

if (!opts["restrict"]) {
if (plugin.tags && plugin.tags.includes("admin")) {
continue
}
}

const strRegex = (str) => str.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&")
const pluginPrefix = plugin.customPrefix || this.prefix || global.prefix

const match = (
pluginPrefix instanceof RegExp ?
[[pluginPrefix.exec(m.text), pluginPrefix]] :
Array.isArray(pluginPrefix) ?
pluginPrefix.map(prefix => {
const regex = prefix instanceof RegExp ? prefix : new RegExp(strRegex(prefix))
return [regex.exec(m.text), regex]
}) :
typeof pluginPrefix === "string" ?
[[new RegExp(strRegex(pluginPrefix)).exec(m.text), new RegExp(strRegex(pluginPrefix))]] :
[[[], new RegExp]]
).find(prefix => prefix[1])

if (typeof plugin.before === "function") {
if (await plugin.before.call(this, m, {
match,
conn: this,
participants,
groupMetadata,
userGroup,
botGroup,
isROwner,
isOwner,
isRAdmin,
isAdmin,
isBotAdmin,
isPrems,
chatUpdate,
__dirname: ___dirname,
__filename,
user,
chat,
settings
})) {
continue
}
}

if (typeof plugin !== "function") continue

if ((usedPrefix = (match[0] || "")[0])) {
const noPrefix = m.text.replace(usedPrefix, "")
let [command, ...args] = noPrefix.trim().split(" ").filter(v => v)
args = args || []
let _args = noPrefix.trim().split(" ").slice(1)
let text = _args.join(" ")
command = (command || "").toLowerCase()
const fail = plugin.fail || global.dfail

const isAccept = plugin.command instanceof RegExp ?
plugin.command.test(command) :
Array.isArray(plugin.command) ?
plugin.command.some(cmd => cmd instanceof RegExp ? cmd.test(command) : cmd === command) :
typeof plugin.command === "string" ?
plugin.command === command : false

global.comando = command

if ((m.id.startsWith("NJX-") || (m.id.startsWith("BAE5") && m.id.length === 16) || (m.id.startsWith("B24E") && m.id.length === 20))) return

if (global.db.data.chats[m.chat].primaryBot && global.db.data.chats[m.chat].primaryBot !== this.user.jid) {
const primaryBotConn = global.conns.find(conn => conn.user.jid === global.db.data.chats[m.chat].primaryBot && conn.ws.socket && conn.ws.socket.readyState !== ws.CLOSED)
const participants = m.isGroup ? (await this.groupMetadata(m.chat).catch(() => ({ participants: [] }))).participants : []
const primaryBotInGroup = participants.some(p => p.jid === global.db.data.chats[m.chat].primaryBot)
if (primaryBotConn && primaryBotInGroup || global.db.data.chats[m.chat].primaryBot === global.conn.user.jid) {
throw !1
} else {
global.db.data.chats[m.chat].primaryBot = null
}
}

if (!isAccept) continue

m.plugin = name
global.db.data.users[m.sender].commands = (global.db.data.users[m.sender].commands || 0) + 1

if (chat.modoadmin && !isOwner && m.isGroup && !isAdmin) return
if (plugin.rowner && plugin.owner && !(isROwner || isOwner)) { fail("owner", m, this); continue }
if (plugin.rowner && !isROwner) { fail("rowner", m, this); continue }
if (plugin.owner && !isOwner) { fail("owner", m, this); continue }
if (plugin.premium && !isPrems) { fail("premium", m, this); continue }
if (plugin.group && !m.isGroup) { fail("group", m, this); continue }
if (plugin.botAdmin && !isBotAdmin) { fail("botAdmin", m, this); continue }
if (plugin.admin && !isAdmin) { fail("admin", m, this); continue }
if (plugin.private && m.isGroup) { fail("private", m, this); continue }

m.isCommand = true
m.exp += plugin.exp ? parseInt(plugin.exp) : 10

let extra = {
match,
usedPrefix,
noPrefix,
_args,
args,
command,
text,
conn: this,
participants,
groupMetadata,
userGroup,
botGroup,
isROwner,
isOwner,
isRAdmin,
isAdmin,
isBotAdmin,
isPrems,
chatUpdate,
__dirname: ___dirname,
__filename,
user,
chat,
settings
}

try {
await plugin.call(this, m, extra)
} catch (err) {
m.error = err
console.error(err)
} finally {
if (typeof plugin.after === "function") {
try {
await plugin.after.call(this, m, extra)
} catch (err) {
console.error(err)
}
}
}
}

} catch (err) {
console.error(err)
}
}

} catch (err) {
console.error(err)
} finally {
if (opts["queque"] && m.text) {
const quequeIndex = this.msgqueque.indexOf(m.id || m.key.id)
if (quequeIndex !== -1)
this.msgqueque.splice(quequeIndex, 1)
}
if (m?.sender && global.db.data.users[m.sender]) {
global.db.data.users[m.sender].exp += m.exp
}
try {
if (!opts["noprint"]) await (await import("./lib/print.js")).default(m, this)
} catch (err) {
console.warn(err)
console.log(m.message)
}
}
}

global.dfail = (type, m, conn) => {
const msg = {
rowner: `*𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈 𝖲𝗈𝗅𝗈 𝖯𝗎𝖾𝖽𝖾 𝖲𝖾𝗋 𝖴𝗌𝖺𝖽𝗈 𝖯𝗈𝗋 𝖬𝗂 𝖢𝗋𝖾𝖺𝖽𝗈𝗋*`,
owner: `*𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈 𝖲𝗈𝗅𝗈 𝖯𝗎𝖾𝖽𝖾 𝖲𝖾𝗋 𝖴𝗍𝗂𝗅𝗂𝗓𝖺𝖽𝗈 𝖯𝗈𝗋 𝖬𝗂 𝖢𝗋𝖾𝖺𝖽𝗈𝗋*`,
mods: `*𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈 𝖲𝗈𝗅𝗈 𝖯𝗎𝖾𝖽𝖾 𝖲𝖾𝗋 𝖴𝗌𝖺𝖽𝗈 𝖯𝗈𝗋 𝖽𝖾𝗌𝖺𝗋𝗋𝗈𝗅𝗅𝖺𝖽𝗈𝗋𝖾𝗌*`,
premium: `*𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈 𝖲𝗈𝗅𝗈 𝖫𝗈 𝖯𝗎𝖾𝖽𝖾𝗇 𝖴𝗍𝗂𝗅𝗂𝗓𝖺𝗋 𝖴𝗌𝗎𝖺𝗋𝗂𝗈𝗌 𝖯𝗋𝖾𝗆𝗂𝗎𝗆*`,
group: `*𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈 𝖲𝗈𝗅𝗈 𝖥𝗎𝗇𝖼𝗂𝗈𝗇𝖺 𝖤𝗇 𝖦𝗋𝗎𝗉𝗈𝗌*`,
private: `*𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈 𝖲𝗈𝗅𝗈 𝖲𝖾 𝖯𝗎𝖾𝖽𝖾 𝖮𝖼𝗎𝗉𝖺𝗋 𝖤𝗇 𝖤𝗅 𝖯𝗋𝗂𝗏𝖺𝖽𝗈*`,
admin: `*𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈 𝖲𝗈𝗅𝗈 𝖯𝗎𝖾𝖽𝖾 𝖲𝖾𝗋 𝖴𝗌𝖺𝖽𝗈 𝖯𝗈𝗋 𝖠𝖽𝗆𝗂𝗇𝗂𝗌𝗍𝗋𝖺𝖽𝗈𝗋𝖾𝗌*`,
botAdmin: `*𝖭𝖾𝖼𝖾𝗌𝗂𝗍𝗈 𝗌𝖾𝗋 𝖠𝖽𝗆𝗂𝗇 𝖯𝖺𝗋𝖺 𝖴𝗌𝖺𝗋 𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈*`,
restrict: `*𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈 𝖧𝖺 𝖲𝗂𝖽𝗈 𝖣𝖾𝗌𝖺𝖻𝗂𝗅𝗂𝗍𝖺𝖽𝗈*`
}[type]
if (msg) return conn.reply(m.chat, msg, m, rcanal).then(() => m.react("✖️"))
}

let file = global.__filename(import.meta.url, true)
watchFile(file, async () => {
unwatchFile(file)
console.log(chalk.magenta("Se actualizo 'handler.js'"))
if (global.reloadHandler) console.log(await global.reloadHandler())
})