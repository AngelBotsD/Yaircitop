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

global.beforeAll = async function (m, { conn }) {
  try {
    const nombreBot = global.namebot || "𝖠𝗇𝗀𝖾𝗅 𝖡𝗈𝗍"
    const bannerFinal = "https://files.catbox.moe/izivd5.jpg"

    const canales = [global.idcanal, global.idcanal2].filter(Boolean)
    const newsletterJidRandom = canales.length
      ? canales[Math.floor(Math.random() * canales.length)]
      : null

    global.rcanal = {
      contextInfo: {
        isForwarded: true,
        forwardingScore: 1,
        ...(newsletterJidRandom && {
          forwardedNewsletterMessageInfo: {
            newsletterJid: newsletterJidRandom,
            serverMessageId: 100,
            newsletterName: global.namecanal
          }
        }),
        externalAdReply: {
          title: nombreBot,
          body: global.author,
          thumbnailUrl: bannerFinal,
          sourceUrl: null,
          mediaType: 1,
          renderLargerThumbnail: false
        }
      }
    }
  } catch (e) {
    console.log("Error al generar rcanal:", e)
  }
}

global.dfail = (type, m, conn) => {
  const msg = {
    rowner: "*𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈 𝖲𝗈𝗅𝗈 𝖯𝗎𝖾𝖽𝖾 𝖲𝖾𝗋 𝖴𝗌𝖺𝖽𝗈 𝖯𝗈𝗋 𝖬𝗂 𝖢𝗋𝖾𝖺𝖽𝗈𝗋*",
    owner: "*𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈 𝖲𝗈𝗅𝗈 𝖯𝗎𝖾𝖽𝖾 𝖲𝖾𝗋 𝖴𝗍𝗂𝗅𝗂𝗓𝖺𝖽𝗈 𝖯𝗈𝗋 𝖬𝗂 𝖢𝗋𝖾𝖺𝖽𝗈𝗋*",
    mods: "*𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈 𝖲𝗈𝗅𝗈 𝖯𝗎𝖾𝖽𝖾 𝖲𝖾𝗋 𝖴𝗌𝖺𝖽𝗈 𝖯𝗈𝗋 𝖽𝖾𝗌𝖺𝗋𝗋𝗈𝗅𝗅𝖺𝖽𝗈𝗋𝖾𝗌*",
    premium: "*𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈 𝖲𝗈𝗅𝗈 𝖫𝗈 𝖯𝗎𝖾𝖽𝖾𝗇 𝖴𝗍𝗂𝗅𝗂𝗓𝖺𝗋 𝖴𝗌𝗎𝖺𝗋𝗂𝗈𝗌 𝖯𝗋𝖾𝗆𝗂𝗎𝗆*",
    group: "*𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈 𝖲𝗈𝗅𝗈 𝖥𝗎𝗇𝖼𝗂𝗈𝗇𝖺 𝖤𝗇 𝖦𝗋𝗎𝗉𝗈𝗌*",
    private: "*𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈 𝖲𝗈𝗅𝗈 𝖲𝖾 𝖯𝗎𝖾𝖽𝖾 𝖮𝖼𝗎𝗉𝖺𝗋 𝖤𝗇 𝖤𝗅 𝖯𝗋𝗂𝗏𝖺𝖽𝗈*",
    admin: "*𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈 𝖲𝗈𝗅𝗈 𝖯𝗎𝖾𝖽𝖾 𝖲𝖾𝗋 𝖴𝗌𝖺𝖽𝗈 𝖯𝗈𝗋 𝖠𝖽𝗆𝗂𝗇𝗂𝗌𝗍𝗋𝖺𝖽𝗈𝗋𝖾𝗌*",
    botAdmin: "*𝖭𝖾𝖼𝖾𝗌𝗂𝗍𝗈 𝗌𝖾𝗋 𝖠𝖽𝗆𝗂𝗇 𝖯𝖺𝗋𝖺 𝖴𝗌𝖺𝗋 𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈*",
    restrict: "*𝖤𝗌𝗍𝖾 𝖢𝗈𝗆𝖺𝗇𝖽𝗈 𝖧𝖺 𝖲𝗂𝖽𝗈 𝖣𝖾𝗌𝖺𝖻𝗂𝗅𝗂𝗍𝖺𝖽𝗈*"
  }[type]

  if (msg)
    conn.reply(m.chat, msg, m, global.rcanal || {})
      .then(() => m.react("✖️"))
}

const fail = (type, m, conn) => global.dfail?.(type, m, conn)

global.handledMessages ||= new Map()
global.recentCommands ||= new Map()
global.groupMetaCache ||= new Map()

export async function handler(chatUpdate) {
  this.msgqueque = this.msgqueque || []
  this.uptime = this.uptime || Date.now()
  if (!chatUpdate) return

  this.pushMessage(chatUpdate.messages).catch(console.error)

  let m = chatUpdate.messages[chatUpdate.messages.length - 1]
  if (!m) return

  if (m?.key?.id) {
    if (!m.fromButton) {
      const prev = global.handledMessages.get(m.key.id)
      if (prev && Date.now() - prev < 120000) return
      global.handledMessages.set(m.key.id, Date.now())
    }
    global.handledMessages.set(m.key.id, Date.now())
  }

  if (Math.random() < 0.05) {
    for (const [k, v] of global.handledMessages)
      if (Date.now() - v > 120000) global.handledMessages.delete(k)
    for (const [k, v] of global.recentCommands)
      if (Date.now() - v > 60000) global.recentCommands.delete(k)
    for (const [k, v] of global.groupMetaCache)
      if (Date.now() - v.ts > 15000) global.groupMetaCache.delete(k)
  }

  if (global.db.data == null)
    await global.loadDatabase()

  try {
    m = smsg(this, m) || m
    if (!m) return

    m.exp = 0
    if (typeof m.text !== "string") m.text = ""

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
    if (m.isBaileys && !m.fromButton) return

    let groupMetadata = {}
    let participants = []
    let userGroup = {}
    let botGroup = {}
    let isRAdmin = false
    let isAdmin = false
    let isBotAdmin = false

    if (m.isGroup) {
      let cached = global.groupMetaCache.get(m.chat)
      if (!cached || Date.now() - cached.ts > 15000) {
        const meta = await this.groupMetadata(m.chat)
        cached = { ts: Date.now(), meta }
        global.groupMetaCache.set(m.chat, cached)
      }

      groupMetadata = cached.meta
      participants = groupMetadata.participants || []

      const userParticipant = participants.find(p => p.id === m.sender || p.jid === m.sender)
      const botParticipant = participants.find(p => p.id === this.user.jid || p.jid === this.user.jid)

      isRAdmin =
        userParticipant?.admin === "superadmin" ||
        DIGITS(m.sender) === DIGITS(groupMetadata.owner)

      isAdmin = isRAdmin || userParticipant?.admin === "admin"
      isBotAdmin =
        botParticipant?.admin === "admin" ||
        botParticipant?.admin === "superadmin"

      userGroup = userParticipant || {}
      botGroup = botParticipant || {}
    }

    const ___dirname = path.join(
      path.dirname(fileURLToPath(import.meta.url)),
      "plugins"
    )

    const extra = {
      conn: this,
      chatUpdate,
      __dirname: ___dirname,
      __filename: "",
      user,
      chat,
      settings,
      participants,
      groupMetadata,
      userGroup,
      botGroup,
      isROwner,
      isOwner,
      isAdmin,
      isBotAdmin,
      isPrems
    }

    if (typeof global.beforeAll === "function") {
      await global.beforeAll.call(this, m, extra)
    }

    for (const name in global.plugins) {
      const plugin = global.plugins[name]
      if (!plugin || plugin.disabled) continue

      const __filename = join(___dirname, name)
      extra.__filename = __filename

      if (typeof plugin.all === "function") {
        await plugin.all.call(this, m, extra)
      }

      let usedPrefix = ""

      if (plugin.customPrefix) {
        if (plugin.customPrefix instanceof RegExp) {
          const match = m.text.match(plugin.customPrefix)
          if (!match) continue
          usedPrefix = match[0]
        } else if (typeof plugin.customPrefix === "string") {
          if (!m.text.startsWith(plugin.customPrefix)) continue
          usedPrefix = plugin.customPrefix
        }
      } else {
        const prefixes = Array.isArray(global.prefixes)
          ? global.prefixes
          : [global.prefix || "."]

        const found = prefixes.find(p =>
          typeof p === "string"
            ? m.text.startsWith(p)
            : p instanceof RegExp
              ? p.test(m.text)
              : false
        )
        if (!found) continue

        usedPrefix =
          found instanceof RegExp
            ? m.text.match(found)?.[0] || ""
            : found
      }

      const noPrefix = m.text.slice(usedPrefix.length)
      let [command, ...args] = noPrefix.trim().split(/\s+/)
      command = (command || "").toLowerCase()

      if (!plugin.command) continue

      const isAccept =
        plugin.command instanceof RegExp
          ? plugin.command.test(command)
          : Array.isArray(plugin.command)
            ? plugin.command.includes(command)
            : plugin.command === command

      if (!isAccept) continue

      m.isCommand = true
      user.commands++

      if (plugin.rowner && plugin.owner && !(isROwner || isOwner)) { fail("owner", m, this); continue }
      if (plugin.rowner && !isROwner) { fail("rowner", m, this); continue }
      if (plugin.owner && !isOwner) { fail("owner", m, this); continue }
      if (plugin.premium && !isPrems) { fail("premium", m, this); continue }
      if (plugin.group && !m.isGroup) { fail("group", m, this); continue }
      if (plugin.botAdmin && !isBotAdmin) { fail("botAdmin", m, this); continue }
      if (plugin.admin && !isAdmin) { fail("admin", m, this); continue }
      if (plugin.private && m.isGroup) { fail("private", m, this); continue }

      await plugin.call(this, m, {
        args,
        command,
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
        chat,
        user,
        settings
      })

      break
    }
  } catch (err) {
    console.error(err)
  }
}

let file = global.__filename(import.meta.url, true)
watchFile(file, async () => {
  unwatchFile(file)
  console.log(chalk.magenta("Se actualizo 'handler.js'"))
  if (global.reloadHandler)
    console.log(await global.reloadHandler())
})