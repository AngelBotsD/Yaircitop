import { smsg } from "./lib/simple.js"
import { fileURLToPath } from "url"
import path, { join } from "path"
import fs, { unwatchFile, watchFile } from "fs"
import chalk from "chalk"

const strRegex = str => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
const ___dirname = path.join(path.dirname(fileURLToPath(import.meta.url)), "plugins")

global.processedMessages ||= new Set()
const ownerCache = new Set(global.owner.map(v => v.replace(/\D/g, "") + "@lid"))
const premsCache = new Set(global.prems.map(v => v.replace(/\D/g, "") + "@lid"))
const globalPrefixes = Array.isArray(global.prefix) ? global.prefix : [global.prefix]

export async function handler(chatUpdate) {
if (!chatUpdate?.messages?.length) return
let m = chatUpdate.messages.at(-1)
if (!m || m.key?.fromMe) return

if (global.processedMessages.has(m.key.id)) return
global.processedMessages.add(m.key.id)
setTimeout(() => global.processedMessages.delete(m.key.id), 60000)

if (global.db.data == null) await global.loadDatabase()

m = smsg(this, m)
if (!m) return
if (typeof m.text !== "string") m.text = ""
if (m.isBaileys) return

const users = global.db.data.users
const chats = global.db.data.chats
const settingsDB = global.db.data.settings

const user = users[m.sender] ||= { name: m.name, premium: false }
const chat = chats[m.chat] ||= {}
const settings = settingsDB[this.user.jid] ||= { self: false }

const isROwner = ownerCache.has(m.sender)
const isOwner = isROwner || m.fromMe
const isPrems = isROwner || premsCache.has(m.sender) || user.premium
if (settings.self && !isOwner) return

let participants = [], isAdmin = false, isBotAdmin = false
if (m.isGroup) {
try {
const groupMetadata = await this.groupMetadata(m.chat)
participants = groupMetadata.participants || []
const userGroup = participants.find(p => p.id === m.sender) || {}
const botGroup = participants.find(p => p.id === this.user.jid) || {}
isAdmin = userGroup.admin === "admin" || userGroup.admin === "superadmin" || m.sender === groupMetadata.owner
isBotAdmin = botGroup.admin === "admin" || botGroup.admin === "superadmin"
} catch {}
}

/* ===== LOOP PLUGINS ===== */
for (const name in global.plugins) {
const plugin = global.plugins[name]
if (!plugin || plugin.disabled) continue
const __filename = join(___dirname, name)

let usedPrefix = null
let match = null
const prefixList = plugin.customPrefix || globalPrefixes
const prefixes = Array.isArray(prefixList) ? prefixList : [prefixList]

for (const p of prefixes) {
const r = p instanceof RegExp ? p : new RegExp("^" + strRegex(p))
const res = r.exec(m.text)
if (res) { usedPrefix = res[0]; match = [res, r]; break }
}

const noPrefix = usedPrefix ? m.text.slice(usedPrefix.length).trim() : m.text.trim()
let [command, ...args] = noPrefix.split(/\s+/)
command = (command || "").toLowerCase()
const text = args.join(" ")

const accept =
plugin.command instanceof RegExp ? plugin.command.test(command) :
Array.isArray(plugin.command) ? plugin.command.includes(command) :
plugin.command === command

if (!accept) continue

const fail = plugin.fail || ((type) => {
const msg = {
rowner: "Solo el creador",
owner: "Solo el owner",
premium: "Solo usuarios premium",
group: "Solo en grupos",
private: "Solo privado",
admin: "Solo admins",
botAdmin: "Necesito ser admin"
}[type]
if (msg) this.reply(m.chat, msg, m)
})

if (plugin.rowner && !isROwner) { fail("rowner"); continue }
if (plugin.owner && !isOwner) { fail("owner"); continue }
if (plugin.premium && !isPrems) { fail("premium"); continue }
if (plugin.group && !m.isGroup) { fail("group"); continue }
if (plugin.private && m.isGroup) { fail("private"); continue }
if (plugin.botAdmin && !isBotAdmin) { fail("botAdmin"); continue }
if (plugin.admin && !isAdmin) { fail("admin"); continue }

m.isCommand = true
m.plugin = name

try { 
await plugin.call(this, m, { usedPrefix: usedPrefix || "", args, command, text, conn: this, participants, isROwner, isOwner, isAdmin, isBotAdmin, isPrems, user, chat, settings }) 
} catch(e){ console.error(e) }
}

/* ===== HOT RELOAD ===== */
let file = global.__filename(import.meta.url, true)
watchFile(file, async () => {
unwatchFile(file)
console.log(chalk.magenta("Se actualizó handler.js"))
if (global.reloadHandler) console.log(await global.reloadHandler())
})