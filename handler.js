import { smsg } from "./lib/simple.js"
import { fileURLToPath } from "url"
import path, { join } from "path"
import fs, { unwatchFile, watchFile } from "fs"
import chalk from "chalk"
import ws from "ws"

const strRegex = str => str.replace(/[|\{}()[]^$+*?.]/g, "\$&")
const ___dirname = path.join(path.dirname(fileURLToPath(import.meta.url)), "plugins")

global.processedMessages ||= new Set()
global.groupCache ||= new Map()
global.prefixRegexCache ||= new Map()
global.stickerCmdMap ||= null
global.ownerCache ||= new Set(global.owner.map(v => v.replace(/\D/g, "") + "@lid"))
global.premsCache ||= new Set(global.prems.map(v => v.replace(/\D/g, "") + "@lid"))
const globalPrefixes = Array.isArray(global.prefix) ? global.prefix : [global.prefix]

export async function handler(chatUpdate) {
if (!chatUpdate?.messages?.length) return
let m = chatUpdate.messages.at(-1)
if (!m || m.key?.fromMe) return

const id = m.key.id
if (global.processedMessages.has(id)) return
global.processedMessages.add(id)
setTimeout(() => global.processedMessages.delete(id), 60000)

if (global.db.data == null) await global.loadDatabase()
m = smsg(this, m)
if (!m) return
if (typeof m.text !== "string") m.text = ""

const users = global.db.data.users
const chats = global.db.data.chats
const settingsDB = global.db.data.settings

const user = users[m.sender] ||= {
name: m.name,
premium: false,
banned: false,
bannedReason: "",
commands: 0
}

const chat = chats[m.chat] ||= {
isBanned: false,
isMute: false,
welcome: false,
sWelcome: "",
sBye: "",
detect: true,
primaryBot: null,
modoadmin: false,
antiLink: true
}

const settings = settingsDB[this.user.jid] ||= {
self: false,
restrict: true,
jadibotmd: true,
antiPrivate: false,
gponly: false
}

const isROwner = global.ownerCache.has(m.sender)
const isOwner = isROwner || m.fromMe
const isPrems = isROwner || global.premsCache.has(m.sender) || user.premium
const isOwners = isOwner || m.sender === this.user.jid

if (settings.self && !isOwners) return
if (m.isBaileys) return

let groupMetadata = {}
let participants = []
let userGroup = {}
let botGroup = {}
let isAdmin = false
let isRAdmin = false
let isBotAdmin = false

if (m.isGroup) {
const cache = global.groupCache.get(m.chat)
if (cache && Date.now() - cache.time < 90000) {
groupMetadata = cache.data
} else {
groupMetadata = await this.groupMetadata(m.chat)
global.groupCache.set(m.chat, { data: groupMetadata, time: Date.now() })
}

participants = groupMetadata.participants || []  
userGroup = participants.find(p => p.id === m.sender) || {}  
botGroup = participants.find(p => p.id === this.user.jid) || {}  

isRAdmin = userGroup.admin === "superadmin" || m.sender === groupMetadata.owner  
isAdmin = isRAdmin || userGroup.admin === "admin"  
isBotAdmin = botGroup.admin === "admin" || botGroup.admin === "superadmin"

}

try {
const st = m.message?.stickerMessage
if (st) {
if (!global.stickerCmdMap) {
try {
global.stickerCmdMap = JSON.parse(fs.readFileSync("./comandos.json", "utf-8"))
} catch {
global.stickerCmdMap = {}
}
}
const sha = st.fileSha256
if (sha) {
const key = Buffer.isBuffer(sha) ? sha.toString("base64") : sha
const cmd = global.stickerCmdMap[key]
if (cmd) {
m.text = cmd.startsWith(globalPrefixes[0]) ? cmd : globalPrefixes[0] + cmd
}
}
}
} catch {}

const hasPrefix = globalPrefixes.some(p =>
p instanceof RegExp ? p.test(m.text) : m.text.startsWith(p)
)

for (const name in global.plugins) {
const plugin = global.plugins[name]
if (!plugin || plugin.disabled) continue
if (!plugin.all && !hasPrefix) continue

const __filename = join(___dirname, name)  
if (typeof plugin.all === "function") {  
  await plugin.all.call(this, m, { chatUpdate, __dirname: ___dirname, __filename, user, chat, settings }).catch(() => {})  
}  

if (!hasPrefix || typeof plugin !== "function") continue  

const prefixList = plugin.customPrefix || globalPrefixes  
const prefixes = Array.isArray(prefixList) ? prefixList : [prefixList]  

let usedPrefix = null  
for (const p of prefixes) {  
  let r = global.prefixRegexCache.get(p)  
  if (!r) {  
    r = p instanceof RegExp ? p : new RegExp(strRegex(p))  
    global.prefixRegexCache.set(p, r)  
  }  
  const m2 = r.exec(m.text)  
  if (m2) {  
    usedPrefix = m2[0]  
    break  
  }  
}  
if (!usedPrefix) continue  

const noPrefix = m.text.slice(usedPrefix.length)  
let [command, ...args] = noPrefix.trim().split(/\s+/)  
command = (command || "").toLowerCase()  
const text = args.join(" ")  

const accept =  
  plugin.command instanceof RegExp  
    ? plugin.command.test(command)  
    : Array.isArray(plugin.command)  
    ? plugin.command.includes(command)  
    : plugin.command === command  

if (!accept) continue  

const adminMode = chat.modoadmin || false
const wa = plugin.botAdmin || plugin.admin || plugin.group || plugin || noPrefix || pluginPrefix || m.text.slice(0, 1) === pluginPrefix || plugin.command
if (adminMode && !isOwner && m.isGroup && !isAdmin && wa) return
if (plugin.rowner && plugin.owner && !(isROwner || isOwner)) {
fail("owner", m, this)
continue
}
if (plugin.rowner && !isROwner) {
fail("rowner", m, this)
continue
}
if (plugin.owner && !isOwner) {
fail("owner", m, this)
continue
}
if (plugin.premium && !isPrems) {
fail("premium", m, this)
continue
}
if (plugin.group && !m.isGroup) {
fail("group", m, this)
continue
} else if (plugin.botAdmin && !isBotAdmin) {
fail("botAdmin", m, this)
continue
} else if (plugin.admin && !isAdmin) {
fail("admin", m, this)
continue
}
if (plugin.private && m.isGroup) {
fail("private", m, this)
continue
}

const fail = plugin.fail || ((type, m, conn, rcanal = null) => {  
  const msg = {  
    rowner: `*𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈 𝖲𝗈𝗅𝗈 𝖯𝗎𝖾𝖽𝖾 𝖲𝖾𝗋 𝖴𝗌𝖺𝖽𝗈 𝖯𝗈𝗋 𝖬𝗂 𝖢𝗋𝖾𝖺𝖽𝗈𝗋*`,  
    owner: `*𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈 𝖲𝗈𝗅𝗈 𝖯𝗎𝖾𝖽𝖾 𝖲𝖾𝗋 𝖴𝗍𝗂𝗅𝗂𝗓𝖺𝖽𝗈 𝖯𝗈𝗋 𝖬𝗂 𝖢𝗋𝖾𝖺𝖽𝗈𝗋*`,  
    mods: `*𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈 𝖲𝗈𝗅𝗈 𝖯𝗎𝖾𝖽𝖾 𝖲𝖾𝗋 𝖴𝗍𝗂𝗅𝗂𝗓𝖺𝖽𝗈 𝖯𝗈𝗋 𝖽𝖾𝗌𝖺𝗋𝗋𝗈𝗅𝗅𝖺𝖽𝗈𝗋𝖾𝗌 𝖮𝖿𝗂𝖼𝗂𝗮𝗅𝖾𝗌*`,  
    premium: `*𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈 𝖲𝗈𝗅𝗈 𝖫𝗈 𝖯𝗎𝖾𝖽𝖾𝗇 𝖴𝗍𝗂𝗅𝗂𝗓𝖺𝗋 𝖴𝗌𝗎𝖺𝗋𝗂𝗈𝗌 𝖯𝗋𝖾𝗆𝗂𝗎𝗆*`,  
    group: `*𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈 𝖲𝗈𝗅𝗈 𝖥𝗎𝗇𝖼𝗂𝗈𝗇𝖺 𝖤𝗇 𝖦𝗋𝗎𝗉𝗈𝗌*`,  
    private: `*𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈 𝖲𝗈𝗅𝗈 𝖲𝖾 𝖯𝗎𝖾𝖽𝖾 𝖮𝖼𝗎𝗉𝖺𝗋 𝖤𝗇 𝖤𝗅 𝖯𝗋𝗂𝗏𝖺𝖽𝗈 𝖣𝖾𝗅 𝖡𝗈𝗍*`,  
    admin: `*𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈 𝖲𝗈𝗅𝗈 𝖯𝗎𝖾𝖽𝖾 𝖲𝖾𝗋 𝖴𝗌𝖺𝖽𝗈 𝖯𝗈𝗋 𝖠𝖽𝗆𝗂𝗇𝗂𝗌𝗍𝗋𝖺𝖽𝗈𝗋𝖾𝗌*`,  
    botAdmin: `*𝖭𝖾𝖼𝖾𝗌𝗂𝗍𝗈 𝗌𝖾𝗋 𝖠𝖽𝗆𝗂𝗇 𝖯𝖺𝗋𝖺 𝖴𝗌𝖺𝗋 𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈*`,  
    unreg: `*𝖭𝗈 𝖤𝗌𝗍𝖺𝗌 𝖱𝖾𝗀𝗂𝗌𝗍𝗋𝖺𝖽𝗈, 𝖴𝗌𝖺 .𝗋𝖾𝗀 (𝗇𝖺𝗆𝖾)*`,  
    restrict: `*𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈 𝖠𝗁 𝖲𝗂𝖽𝗈 𝖣𝖾𝗌𝖺𝖻𝗂𝗅𝗂𝗍𝖺𝖽𝗈 𝖯𝗈𝗋 𝖬𝗂 𝖢𝗋𝖾𝖺𝖽𝗈𝗋*`  
  }[type]  
  if (msg) return conn.reply(m.chat, msg, m, rcanal).then(_ => m.react('✖️'))  
})  

await plugin.call(this, m, {  
  usedPrefix,  
  noPrefix,  
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
}).catch(console.error)

}
}

let file = global.__filename(import.meta.url, true)
watchFile(file, async () => {
unwatchFile(file)
console.log(chalk.magenta("Se actualizo 'handler.js'"))
if (global.reloadHandler) console.log(await global.reloadHandler())
})