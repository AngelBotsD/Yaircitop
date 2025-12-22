
import { smsg } from "./lib/simple.js"
import { fileURLToPath } from "url"
import path, { join } from "path"
import fs, { unwatchFile, watchFile } from "fs"
import chalk from "chalk"

const isNumber = x => typeof x === "number" && !isNaN(x)
const delay = ms => isNumber(ms) && new Promise(resolve => setTimeout(resolve, ms))

export async function handler(chatUpdate) {
this.msgqueque = this.msgqueque || []
this.uptime = this.uptime || Date.now()
if (!chatUpdate) return

this.pushMessage(chatUpdate.messages).catch(console.error)
let m = chatUpdate.messages?.[chatUpdate.messages.length - 1]
if (!m) return

if (global.db.data == null)
await global.loadDatabase()

m = smsg(this, m) || m
if (!m) return
if (typeof m.text !== "string") m.text = ""
m.exp = 0

const users = global.db.data.users
const chats = global.db.data.chats
const settingsDB = global.db.data.settings

if (!users[m.sender]) users[m.sender] = { exp: 0 }
if (!chats[m.chat]) chats[m.chat] = {}
if (!settingsDB[this.user.jid]) settingsDB[this.user.jid] = {}

const user = users[m.sender]
const chat = chats[m.chat]
const settings = settingsDB[this.user.jid]

/* === STICKER → COMANDO === */
try {
const st =
m.message?.stickerMessage ||
m.message?.ephemeralMessage?.message?.stickerMessage ||
null

if (st) {
const jsonPath = "./comandos.json"
if (!fs.existsSync(jsonPath)) fs.writeFileSync(jsonPath, "{}")
const map = JSON.parse(fs.readFileSync(jsonPath, "utf-8") || "{}")

const rawSha = st.fileSha256 || st.fileSha256Hash || st.filehash
const hashes = []

if (rawSha) {
if (Buffer.isBuffer(rawSha)) hashes.push(rawSha.toString("base64"))
else if (ArrayBuffer.isView(rawSha)) hashes.push(Buffer.from(rawSha).toString("base64"))
else if (typeof rawSha === "string") hashes.push(rawSha)
}

for (const h of hashes) {
if (map[h]) {
const pref = (Array.isArray(global.prefixes) && global.prefixes[0]) || "."
m.text = (map[h].startsWith(pref) ? map[h] : pref + map[h]).toLowerCase()
break
}}
}
} catch (e) {
console.error("Sticker error:", e)
}
/* === FIN STICKER === */

if (opts["queque"] && m.text) {
const q = this.msgqueque
const id = m.id || m.key.id
q.push(id)
setTimeout(() => {
const i = q.indexOf(id)
if (i !== -1) q.splice(i, 1)
}, 5000)
}

if (m.isBaileys) return
m.exp += Math.ceil(Math.random() * 10)

/* === METADATA SOLO INFO === */
let groupMetadata = null
let participants = []

if (m.isGroup) {
  try {
    groupMetadata = await this.groupMetadata(m.chat)
    participants = groupMetadata?.participants || []
  } catch {}
}

const ___dirname = path.join(
path.dirname(fileURLToPath(import.meta.url)),
"plugins"
)

for (const name in global.plugins) {
const plugin = global.plugins[name]
if (!plugin || plugin.disabled) continue
const __filename = join(___dirname, name)

/* plugin.all */
if (typeof plugin.all === "function") {
await plugin.all.call(this, m, {
chatUpdate,
groupMetadata,
participants,
__dirname: ___dirname,
__filename,
user,
chat,
settings
})
}

/* prefijos */
const strRegex = s => s.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&")
const prefix = plugin.customPrefix || global.prefix || "."
const match = (prefix instanceof RegExp
? [[prefix.exec(m.text), prefix]]
: Array.isArray(prefix)
? prefix.map(p => {
const r = p instanceof RegExp ? p : new RegExp(strRegex(p))
return [r.exec(m.text), r]
})
: [[new RegExp(strRegex(prefix)).exec(m.text), new RegExp(strRegex(prefix))]]
).find(p => p[1])

if (!match || !match[0]) continue

const usedPrefix = match[0][0]
const noPrefix = m.text.slice(usedPrefix.length)
let [command, ...args] = noPrefix.trim().split(/\s+/)
command = (command || "").toLowerCase()

const accept =
plugin.command instanceof RegExp
? plugin.command.test(command)
: Array.isArray(plugin.command)
? plugin.command.includes(command)
: plugin.command === command

if (!accept) continue

m.plugin = name
m.isCommand = true
m.exp += plugin.exp || 10

let extra = {
match,
usedPrefix,
noPrefix,
args,
command,
text: args.join(" "),
conn: this,
chatUpdate,
groupMetadata,
participants,
__dirname: ___dirname,
__filename,
user,
chat,
settings
}

try {
await plugin.call(this, m, extra)
} catch (e) {
console.error(e)
} finally {
if (typeof plugin.after === "function") {
await plugin.after.call(this, m, extra)
}
}
}

if (m?.sender) user.exp += m.exp

try {
if (!opts["noprint"])
(await import("./lib/print.js")).default(m, this)
} catch {}
}

let file = global.__filename(import.meta.url, true)
watchFile(file, async () => {
unwatchFile(file)
console.log(chalk.magenta("Se actualizó handler.js"))
if (global.reloadHandler) console.log(await global.reloadHandler())
})