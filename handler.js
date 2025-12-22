import { smsg } from "./lib/simple.js"
import { fileURLToPath } from "url"
import path, { join } from "path"
import fs, { unwatchFile, watchFile } from "fs"
import chalk from "chalk"
import ws from "ws"

/* ========= HELPERS ========= */
const strRegex = str => str.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&")
const ___dirname = path.join(path.dirname(fileURLToPath(import.meta.url)), "plugins")

/* ========= CACHES ========= */
global.processedMessages ||= new Set()
global.groupCache ||= new Map()
global.prefixRegexCache ||= new Map()
global.stickerCmdMap ||= null

global.ownerCache ||= new Set(global.owner.map(v => v.replace(/\D/g, "") + "@lid"))
global.premsCache ||= new Set(global.prems.map(v => v.replace(/\D/g, "") + "@lid"))

const globalPrefixes = Array.isArray(global.prefix) ? global.prefix : [global.prefix]

/* ========= HANDLER ========= */
export async function handler(chatUpdate) {
  if (!chatUpdate?.messages?.length) return

  let m = chatUpdate.messages.at(-1)
  if (!m || m.key?.fromMe) return

  const id = m.key.id
  if (global.processedMessages.has(id)) return
  global.processedMessages.add(id)
  setTimeout(() => global.processedMessages.delete(id), 60_000)

  if (global.db.data == null) await global.loadDatabase()

  m = smsg(this, m)
  if (!m) return
  if (typeof m.text !== "string") m.text = ""

  /* ========= DB ========= */
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

  /* ========= ROLES ========= */
  const isROwner = global.ownerCache.has(m.sender)
  const isOwner = isROwner || m.fromMe
  const isPrems = isROwner || global.premsCache.has(m.sender) || user.premium
  const isOwners = isOwner || m.sender === this.user.jid

  if (settings.self && !isOwners) return
  if (m.isBaileys) return

  /* ========= GRUPOS (CACHE FUERTE) ========= */
  let groupMetadata = {}
  let participants = []
  let userGroup = {}
  let botGroup = {}
  let isAdmin = false
  let isRAdmin = false
  let isBotAdmin = false

  if (m.isGroup) {
    const cache = global.groupCache.get(m.chat)
    if (cache && Date.now() - cache.time < 90_000) {
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

  /* ========= STICKER → CMD (CACHEADO) ========= */
  try {
    const st = m.message?.stickerMessage
    if (st) {
      if (!global.stickerCmdMap) {
        try {
          global.stickerCmdMap = JSON.parse(fs.readFileSync("./comandos.json"))
        } catch {
          global.stickerCmdMap = {}
        }
      }

      const sha = st.fileSha256
      if (sha) {
        const key = Buffer.isBuffer(sha) ? sha.toString("base64") : sha
        const cmd = global.stickerCmdMap[key]
        if (cmd) {
          m.text = cmd.startsWith(globalPrefixes[0])
            ? cmd
            : globalPrefixes[0] + cmd
        }
      }
    }
  } catch {}

  /* ========= PREFIJO EARLY ========= */
  const hasPrefix = globalPrefixes.some(p =>
    p instanceof RegExp ? p.test(m.text) : m.text.startsWith(p)
  )

  /* ========= PLUGINS ========= */
  for (const name in global.plugins) {
    const plugin = global.plugins[name]
    if (!plugin || plugin.disabled) continue
    if (!plugin.all && !hasPrefix) continue

    const __filename = join(___dirname, name)

    if (typeof plugin.all === "function") {
      await plugin.all.call(this, m, {
        chatUpdate,
        __dirname: ___dirname,
        __filename,
        user,
        chat,
        settings
      }).catch(() => {})
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

    const fail = plugin.fail || global.dfail

    if (plugin.rowner && !isROwner) return fail("rowner", m, this)
    if (plugin.owner && !isOwner) return fail("owner", m, this)
    if (plugin.premium && !isPrems) return fail("premium", m, this)
    if (plugin.group && !m.isGroup) return fail("group", m, this)
    if (plugin.botAdmin && !isBotAdmin) return fail("botAdmin", m, this)
    if (plugin.admin && !isAdmin) return fail("admin", m, this)
    if (plugin.private && m.isGroup) return fail("private", m, this)

    user.commands++

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

/* ========= HOT RELOAD ========= */
let file = global.__filename(import.meta.url, true)
watchFile(file, async () => {
  unwatchFile(file)
  console.log(chalk.magenta("Se actualizo 'handler.js'"))
  if (global.reloadHandler) console.log(await global.reloadHandler())
})