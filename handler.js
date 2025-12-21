import { smsg } from "./lib/simple.js"
import { fileURLToPath } from "url"
import path, { join } from "path"
import fs, { watchFile, unwatchFile } from "fs"
import chalk from "chalk"
import ws from "ws"

/* ================== HELPERS ================== */

const strRegex = str => str.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&")
const isNumber = x => typeof x === "number" && !isNaN(x)
const delay = ms => isNumber(ms) && new Promise(r => setTimeout(r, ms))

const ___dirname = path.join(path.dirname(fileURLToPath(import.meta.url)), "plugins")

/* ================== CACHES ================== */

global.processedMessages ||= new Set()
global.prefixRegexCache ||= new Map()
global.groupCache ||= new Map()

const ownerCache = new Set(global.owner.map(v => v.replace(/\D/g, "") + "@lid"))
const premsCache = new Set(global.prems.map(v => v.replace(/\D/g, "") + "@lid"))
const globalPrefixes = Array.isArray(global.prefix) ? global.prefix : [global.prefix]

/* ================== HANDLER ================== */

export async function handler(chatUpdate) {
  this.msgqueque ||= []
  this.uptime ||= Date.now()

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

  /* ================== DB INIT ================== */

  const users = global.db.data.users
  const chats = global.db.data.chats
  const settingsDB = global.db.data.settings

  const user = users[m.sender] ||= {
    name: m.name,
    exp: 0,
    coin: 0,
    bank: 0,
    level: 0,
    health: 100,
    premium: false,
    premiumTime: 0,
    banned: false,
    bannedReason: "",
    commands: 0,
    afk: -1,
    afkReason: "",
    warn: 0
  }

  const chat = chats[m.chat] ||= {
    isBanned: false,
    isMute: false,
    welcome: false,
    detect: true,
    modoadmin: false,
    antiLink: true,
    nsfw: false,
    economy: true,
    gacha: true,
    primaryBot: null
  }

  const settings = settingsDB[this.user.jid] ||= {
    self: false,
    restrict: true,
    jadibotmd: true,
    antiPrivate: false,
    gponly: false
  }

  const isROwner = ownerCache.has(m.sender)
  const isOwner = isROwner || m.fromMe
  const isPrems = isROwner || premsCache.has(m.sender) || user.premium

  if (settings.self && !isOwner) return

  /* ================== STICKER → CMD ================== */

  try {
    const st =
      m.message?.stickerMessage ||
      m.message?.ephemeralMessage?.message?.stickerMessage

    if (st) {
      const jsonPath = "./comandos.json"
      if (!fs.existsSync(jsonPath)) fs.writeFileSync(jsonPath, "{}")
      const map = JSON.parse(fs.readFileSync(jsonPath, "utf8"))

      const rawSha = st.fileSha256 || st.fileSha256Hash || st.filehash
      const hashes = []

      if (Buffer.isBuffer(rawSha)) hashes.push(rawSha.toString("base64"))
      else if (ArrayBuffer.isView(rawSha)) hashes.push(Buffer.from(rawSha).toString("base64"))
      else if (typeof rawSha === "string") hashes.push(rawSha)

      for (const h of hashes) {
        if (map[h]) {
          const pref = globalPrefixes[0] || "."
          m.text = map[h].startsWith(pref) ? map[h] : pref + map[h]
          break
        }
      }
    }
  } catch {}

  /* ================== GROUP DATA ================== */

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

      userGroup = participants.find(p => p.id === m.sender) || {}
      botGroup = participants.find(p => p.id === this.user.jid) || {}

      isRAdmin = userGroup.admin === "superadmin" || m.sender === groupMetadata.owner
      isAdmin = isRAdmin || userGroup.admin === "admin"
      isBotAdmin = botGroup.admin === "admin" || botGroup.admin === "superadmin"
    } catch {}
  }

  /* ================== PLUGINS LOOP ================== */

  for (const name in global.plugins) {
    const plugin = global.plugins[name]
    if (!plugin || plugin.disabled) continue

    const __filename = join(___dirname, name)

    /* ===== plugin.all ===== */
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
      } catch {}
    }

    /* ===== PREFIX ===== */

    let usedPrefix = null
    let match = null

    const prefixList = plugin.customPrefix || globalPrefixes
    const prefixes = Array.isArray(prefixList) ? prefixList : [prefixList]

    for (const p of prefixes) {
      let r = global.prefixRegexCache.get(p)
      if (!r) {
        r = p instanceof RegExp ? p : new RegExp("^" + strRegex(p))
        global.prefixRegexCache.set(p, r)
      }
      const res = r.exec(m.text)
      if (res) {
        usedPrefix = res[0]
        match = [res, r]
        break
      }
    }

    /* ===== plugin.before ===== */

    if (typeof plugin.before === "function") {
      const stop = await plugin.before.call(this, m, {
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
      })
      if (stop) continue
    }

    /* ===== COMMAND PARSE ===== */

    const noPrefix = usedPrefix
      ? m.text.slice(usedPrefix.length).trim()
      : m.text.trim()

    let [command, ...args] = noPrefix.split(/\s+/)
    command = (command || "").toLowerCase()
    const text = args.join(" ")

    const isAccept =
      plugin.command instanceof RegExp
        ? plugin.command.test(command)
        : Array.isArray(plugin.command)
        ? plugin.command.some(cmd =>
            cmd instanceof RegExp ? cmd.test(command) : cmd === command
          )
        : typeof plugin.command === "string"
        ? plugin.command === command
        : false

    if (!isAccept) continue

    /* ===== FAIL ===== */

    const fail = plugin.fail || ((type) => {
      const msg = {
        rowner: "Solo el creador",
        owner: "Solo el owner",
        premium: "Solo premium",
        group: "Solo grupos",
        private: "Solo privado",
        admin: "Solo admins",
        botAdmin: "Necesito ser admin"
      }[type]
      if (msg) this.reply(m.chat, msg, m)
    })

    if (chat.modoadmin && m.isGroup && !isAdmin && !isOwner) continue

    if (plugin.rowner && !isROwner) { fail("rowner"); continue }
    if (plugin.owner && !isOwner) { fail("owner"); continue }
    if (plugin.premium && !isPrems) { fail("premium"); continue }
    if (plugin.group && !m.isGroup) { fail("group"); continue }
    if (plugin.private && m.isGroup) { fail("private"); continue }
    if (plugin.botAdmin && !isBotAdmin) { fail("botAdmin"); continue }
    if (plugin.admin && !isAdmin) { fail("admin"); continue }

    /* ===== PRIMARY BOT ===== */

    if (chat.primaryBot && chat.primaryBot !== this.user.jid) {
      const connPrimary = global.conns?.find(c =>
        c.user?.jid === chat.primaryBot &&
        c.ws?.socket?.readyState !== ws.CLOSED
      )
      if (connPrimary) continue
      chat.primaryBot = null
    }

    /* ===== EXEC ===== */

    m.isCommand = true
    m.plugin = name
    user.commands++

    const extra = {
      match,
      usedPrefix: usedPrefix || "",
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
    }

    try {
      await plugin.call(this, m, extra)
    } catch (e) {
      console.error(e)
    } finally {
      if (typeof plugin.after === "function") {
        try {
          await plugin.after.call(this, m, extra)
        } catch {}
      }
    }
  }
}

/* ================== HOT RELOAD ================== */

let file = global.__filename(import.meta.url, true)
watchFile(file, async () => {
  unwatchFile(file)
  console.log(chalk.magenta("Se actualizó handler.js"))
  if (global.reloadHandler) console.log(await global.reloadHandler())
})