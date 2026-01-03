import { smsg } from "./lib/simple.js"
import { format } from "util"
import { fileURLToPath } from "url"
import path, { join } from "path"
import fs, { unwatchFile, watchFile } from "fs"
import chalk from "chalk"
import fetch from "node-fetch"
import ws from "ws"
import { jidNormalizedUser } from "@whiskeysockets/baileys"

const isNumber = x => typeof x === "number" && !isNaN(x)
const delay = ms => isNumber(ms) && new Promise(resolve => setTimeout(resolve, ms))

const DIGITS = (s = "") => String(s).replace(/\D/g, "")
const norm = jid => jidNormalizedUser(jid || "")

const OWNER_NUMBERS = (global.owner || []).map(v =>
  Array.isArray(v) ? DIGITS(v[0]) : DIGITS(v)
)

function isOwnerBySender(sender) {
  return OWNER_NUMBERS.includes(DIGITS(sender))
}

const handledMessages = new Map()
const HANDLED_TTL_MS = 120000

function isDuplicate(sock, msg) {
  const id = msg?.key?.id
  if (!id) return false
  const key = `${sock?.user?.jid || "main"}:${id}`
  const now = Date.now()
  const prev = handledMessages.get(key)
  if (prev && now - prev < HANDLED_TTL_MS) return true
  handledMessages.set(key, now)
  return false
}

const groupMetaCache = new Map()
const GROUP_META_TTL_MS = 15000

const recentCommands = new Map()
const RECENT_WINDOW_MS = 1500

function isRateLimited(sender, cmd) {
  const key = `${sender}:${cmd}`
  const now = Date.now()
  const prev = recentCommands.get(key)
  if (prev && now - prev < RECENT_WINDOW_MS) return true
  recentCommands.set(key, now)
  return false
}

function getMessageText(msg) {
  const m = msg.message || {}
  return (
    m.conversation ||
    m.extendedTextMessage?.text ||
    m.imageMessage?.caption ||
    m.videoMessage?.caption ||
    m.documentMessage?.caption ||
    ""
  )
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
    if (isDuplicate(this, m)) return
    m.exp = 0

    m.text = typeof m.text === "string" && m.text ? m.text : getMessageText(m)

    try {
      const st =
        m.message?.stickerMessage ||
        m.message?.ephemeralMessage?.message?.stickerMessage ||
        null

      if (st && m.isGroup) {
        const jsonPath = "./comandos.json"
        if (!fs.existsSync(jsonPath)) fs.writeFileSync(jsonPath, "{}")

        const map = JSON.parse(fs.readFileSync(jsonPath, "utf-8") || "{}")
        const groupMap = map[m.chat]
        if (!groupMap) return

        const rawSha = st.fileSha256 || st.fileSha256Hash || st.filehash
        const candidates = []

        if (rawSha) {
          if (Buffer.isBuffer(rawSha)) candidates.push(rawSha.toString("base64"))
          else if (ArrayBuffer.isView(rawSha)) candidates.push(Buffer.from(rawSha).toString("base64"))
          else if (typeof rawSha === "string") candidates.push(rawSha)
        }

        let mapped = null
        for (const k of candidates) {
          if (groupMap[k] && groupMap[k].trim()) {
            mapped = groupMap[k].trim()
            break
          }
        }

        if (mapped) {
          const pref = (Array.isArray(global.prefixes) && global.prefixes[0]) || "."
          const injected = mapped.startsWith(pref) ? mapped : pref + mapped
          m.text = injected.toLowerCase()
          m.isCommand = true
        }
      }
    } catch {}

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
      const cacheKey = `${this.user.jid}:${m.chat}`
      const cached = groupMetaCache.get(cacheKey)
      if (cached && Date.now() - cached.ts < GROUP_META_TTL_MS) {
        ({ groupMetadata, participants, userGroup, botGroup, isRAdmin, isAdmin, isBotAdmin } = cached)
      } else {
        groupMetadata = await this.groupMetadata(m.chat)
        participants = groupMetadata.participants || []

        userGroup = participants.find(p =>
  norm(p.id || p.jid) === norm(m.sender)
) || {}

botGroup = participants.find(p =>
  norm(p.id || p.jid) === norm(this.user.jid)
) || {}

isRAdmin =
  userGroup.admin === "superadmin" ||
  DIGITS(m.sender) === DIGITS(groupMetadata.owner || "")

isAdmin =
  userGroup.admin === "admin" ||
  userGroup.admin === "superadmin"

isBotAdmin =
  botGroup.admin === "admin" ||
  botGroup.admin === "superadmin"

        groupMetaCache.set(cacheKey, {
          ts: Date.now(),
          groupMetadata,
          participants,
          userGroup,
          botGroup,
          isRAdmin,
          isAdmin,
          isBotAdmin
        })
      }
    }

    let usedPrefix = ""
    const ___dirname = path.join(path.dirname(fileURLToPath(import.meta.url)), "plugins")

    for (const name in global.plugins) {
      const plugin = global.plugins[name]
      if (!plugin || plugin.disabled) continue

      const __filename = join(___dirname, name)

      if (typeof plugin.all === "function") {
        try {
          await plugin.all.call(this, m, { chatUpdate, __dirname: ___dirname, __filename, user, chat, settings })
        } catch {}
      }

      const strRegex = str => str.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&")
      const pluginPrefix = plugin.customPrefix || this.prefix || global.prefix

      const match = (
        pluginPrefix instanceof RegExp
          ? [[pluginPrefix.exec(m.text), pluginPrefix]]
          : Array.isArray(pluginPrefix)
          ? pluginPrefix.map(p => {
              const r = p instanceof RegExp ? p : new RegExp(strRegex(p))
              return [r.exec(m.text), r]
            })
          : typeof pluginPrefix === "string"
          ? [[new RegExp(strRegex(pluginPrefix)).exec(m.text), new RegExp(strRegex(pluginPrefix))]]
          : [[[], new RegExp]]
      ).find(p => p[1])

      if (typeof plugin.before === "function") {
        if (await plugin.before.call(this, m, {
          match, conn: this, participants, groupMetadata, userGroup, botGroup,
          isROwner, isOwner, isRAdmin, isAdmin, isBotAdmin, isPrems,
          chatUpdate, __dirname: ___dirname, __filename, user, chat, settings
        })) continue
      }

      if (typeof plugin !== "function") continue

      if ((usedPrefix = (match[0] || "")[0])) {
        const noPrefix = m.text.replace(usedPrefix, "")
        let [command, ...args] = noPrefix.trim().split(" ").filter(v => v)
        command = (command || "").toLowerCase()
        if (isRateLimited(m.sender, command)) continue

        const fail = plugin.fail || global.dfail
        const isAccept =
          plugin.command instanceof RegExp ? plugin.command.test(command)
          : Array.isArray(plugin.command) ? plugin.command.some(c => c instanceof RegExp ? c.test(command) : c === command)
          : typeof plugin.command === "string" ? plugin.command === command : false

        if (!isAccept) continue

        m.plugin = name
        global.db.data.users[m.sender].commands++

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

        await plugin.call(this, m, {
          match, usedPrefix, noPrefix, args,
          command, text: args.join(" "),
          conn: this, participants, groupMetadata,
          userGroup, botGroup,
          isROwner, isOwner, isRAdmin, isAdmin, isBotAdmin, isPrems,
          chatUpdate, __dirname: ___dirname, __filename, user, chat, settings
        })
      }
    }
  } finally {
    if (opts["queque"] && m.text) {
      const qi = this.msgqueque.indexOf(m.id || m.key.id)
      if (qi !== -1) this.msgqueque.splice(qi, 1)
    }
    if (m?.sender && global.db.data.users[m.sender]) {
      global.db.data.users[m.sender].exp += m.exp
    }
    try {
      if (!opts["noprint"]) await (await import("./lib/print.js")).default(m, this)
    } catch {}
  }
}

global.dfail = (type, m, conn) => {
  const msg = {
    rowner: `*𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈 𝖲𝗈𝗅𝗈 𝖯𝗎𝖾𝖽𝖾 𝖲𝖾𝗋 𝖴𝗌𝖺𝖽𝗈 𝖯𝗈𝗋 𝖬𝗂 𝖢𝗋𝖾𝖺𝖽𝗈𝗋*`,
    owner: `*𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈 𝖲𝗈𝗅𝗈 𝖯𝗎𝖾𝖽𝖾 𝖲𝖾𝗋 𝖴𝗍𝗂𝗅𝗂𝗓𝖺𝖽𝗈 𝖯𝗈𝗋 𝖬𝗂 𝖢𝗋𝖾𝖺𝖽𝗈𝗋*`,
    mods: `*𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈 𝖲𝗈𝗅𝗈 𝖯𝗎𝖾𝖽𝖾 𝖲𝖾𝗋 𝖴𝗌𝖺𝖽𝗈 𝖯𝗈𝗋 𝖽𝖾𝗌𝖺𝗋𝗋𝗈𝗅𝗅𝖺𝖽𝗈𝗋𝖾𝗌*`,
    premium: `*𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈 𝖲𝗈𝗅𝗈 𝖫𝗈 𝖯𝗎𝖾𝖽𝖾𝗇 𝖴𝗍𝗂𝗅𝗂𝗓𝖺𝗋 𝖴𝗌𝖺𝗋𝗂𝗈𝗌 𝖯𝗋𝖾𝗆𝗂𝗎𝗆*`,
    group: `*𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈 𝖲𝗈𝗅𝗈 𝖥𝗎𝗇𝖼𝗂𝗈𝗇𝖺 𝖤𝗇 𝖦𝗋𝗎𝗉𝗈𝗌*`,
    private: `*𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈 𝖲𝗈𝗅𝗈 𝖲𝖾 𝖯𝗎𝖾𝖽𝖾 𝖮𝖼𝗎𝗉𝖺𝗋 𝖤𝗇 𝖤𝗅 𝖯𝗋𝗂𝗏𝖺𝖽𝗈*`,
    admin: `*𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈 𝖲𝗈𝗅𝗈 𝖯𝗎𝖾𝖽𝖾 𝖲𝖾𝗋 𝖴𝗌𝖺𝖽𝗈 𝖯𝗈𝗋 𝖠𝖽𝗆𝗂𝗇𝗂𝗌𝗍𝗋𝖺𝖽𝗈𝗋𝖾𝗌*`,
    botAdmin: `*𝖭𝖾𝖼𝖾𝗌𝗂𝗍𝗈 𝗌𝖾𝗋 𝖠𝖽𝗆𝗂𝗇 𝖯𝖺𝗋𝖺 𝖴𝗌𝖺𝗋 𝖤𝗌𝖙𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈*`,
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