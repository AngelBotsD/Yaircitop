import { smsg } from "./lib/simple.js"
import { format } from "util"
import { fileURLToPath } from "url"
import path, { join } from "path"
import fs, { unwatchFile, watchFile } from "fs"
import chalk from "chalk"
import fetch from "node-fetch"
import ws from "ws"

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

    if (typeof m.text !== "string") m.text = ""

    const user = global.db.data.users[m.sender]
    if (typeof user !== "object") global.db.data.users[m.sender] = {}

    const chat = global.db.data.chats[m.chat]
    if (typeof chat !== "object") {
      global.db.data.chats[m.chat] = {
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
    }

    if (!("isMute" in chat)) chat.isMute = false
    if (!("welcome" in chat)) chat.welcome = false
    if (!("sWelcome" in chat)) chat.sWelcome = ""
    if (!("sBye" in chat)) chat.sBye = ""
    if (!("detect" in chat)) chat.detect = true
    if (!("primaryBot" in chat)) chat.primaryBot = null
    if (!("modoadmin" in chat)) chat.modoadmin = false
    if (!("antiLink" in chat)) chat.antiLink = true
    if (!("nsfw" in chat)) chat.nsfw = false

    const settings = global.db.data.settings[this.user.jid]
    if (typeof settings !== "object") global.db.data.settings[this.user.jid] = {}

    if (!("self" in settings)) settings.self = false
    if (!("restrict" in settings)) settings.restrict = true
    if (!("antiPrivate" in settings)) settings.antiPrivate = false
    if (!("gponly" in settings)) settings.gponly = false

    /* === STICKER → COMANDO GLOBAL === */
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
        const candidates = []

        if (rawSha) {
          if (Buffer.isBuffer(rawSha)) candidates.push(rawSha.toString("base64"))
          else if (ArrayBuffer.isView(rawSha)) candidates.push(Buffer.from(rawSha).toString("base64"))
          else if (typeof rawSha === "string") candidates.push(rawSha)
        }

        for (const k of candidates) {
          if (map[k] && map[k].trim()) {
            const pref = (Array.isArray(global.prefixes) && global.prefixes[0]) || "."
            m.text = map[k].startsWith(pref) ? map[k] : pref + map[k]
            console.log("✅ Sticker detectado, comando inyectado:", m.text)
            break
          }
        }
      }
    } catch (e) {
      console.error("❌ Error Sticker→cmd:", e)
    }
    /* === FIN STICKER → COMANDO === */

    try {
      const actual = user.name || ""
      const nuevo = m.pushName || await this.getName(m.sender)
      if (typeof nuevo === "string" && nuevo.trim() && nuevo !== actual) {
        user.name = nuevo
      }
    } catch {}

    const isOwner =
      m.fromMe ||
      global.owner.includes(m.sender?.split("@")[0])

    const isowners = [this.user.jid, ...global.owner.map(n => n + "@lid")].includes(m.sender)

    if (settings.self && !isowners) return

    if (
      settings.gponly &&
      !isowners &&
      !m.chat.endsWith("g.us") &&
      !/code|p|ping|qr|estado|status|infobot|botinfo|report|reportar|invite|join|logout|suggest|help|menu/gim.test(m.text)
    ) return

    if (opts["queque"] && m.text) {
      const queque = this.msgqueque
      const time = 1000 * 5
      const previousID = queque[queque.length - 1]

      queque.push(m.id || m.key.id)

      setInterval(async function () {
        if (queque.indexOf(previousID) === -1) clearInterval(this)
        await delay(time)
      }, time)
    }

    if (m.isBaileys) return
    m.exp += Math.ceil(Math.random() * 10)

    let usedPrefix
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

        const userParticipant = participants.find(p => p.id === m.sender)
        isRAdmin = userParticipant?.admin === "superadmin" || m.sender === groupMetadata.owner
        isAdmin = isRAdmin || userParticipant?.admin === "admin"

        const botParticipant = participants.find(p => p.id === this.user.jid)
        isBotAdmin = botParticipant?.admin === "admin" || botParticipant?.admin === "superadmin"

        userGroup = userParticipant || {}
        botGroup = botParticipant || {}
      } catch (e) {
        console.error("Error obteniendo metadata del grupo:", e)
      }
    }

    const ___dirname = path.join(path.dirname(fileURLToPath(import.meta.url)), "plugins")

    for (const name in global.plugins) {
      const plugin = global.plugins[name]
      if (!plugin || plugin.disabled) continue

      const __filename = join(___dirname, name)

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

      if (!opts["restrict"] && plugin.tags?.includes("admin")) continue

      const strRegex = str => str.replace(/[|\\{}()[\]^$+*?.]/g, "\\$&")
      const pluginPrefix = plugin.customPrefix || conn.prefix || global.prefix
      const match = (pluginPrefix instanceof RegExp
        ? [[pluginPrefix.exec(m.text), pluginPrefix]]
        : Array.isArray(pluginPrefix)
        ? pluginPrefix.map(prefix => {
            const regex = prefix instanceof RegExp ? prefix : new RegExp(strRegex(prefix))
            return [regex.exec(m.text), regex]
          })
        : typeof pluginPrefix === "string"
        ? [[new RegExp(strRegex(pluginPrefix)).exec(m.text), new RegExp(strRegex(pluginPrefix))]]
        : [[[], new RegExp]]
      ).find(p => p[1])

      if (typeof plugin.before === "function") {
        if (await plugin.before.call(this, m, {
          match,
          conn: this,
          participants,
          groupMetadata,
          userGroup,
          botGroup,
          isOwner,
          isRAdmin,
          isAdmin,
          isBotAdmin,
          chatUpdate,
          __dirname: ___dirname,
          __filename,
          user,
          chat,
          settings
        })) continue
      }

      if (typeof plugin !== "function") continue

      if ((usedPrefix = (match[0] || "")[0])) {
        const noPrefix = m.text.replace(usedPrefix, "")
        let [command, ...args] = noPrefix.trim().split(" ").filter(v => v)
        let _args = noPrefix.trim().split(" ").slice(1)
        let text = _args.join(" ")
        command = (command || "").toLowerCase()

        const fail = plugin.fail || global.dfail
        const isAccept = plugin.command instanceof RegExp
          ? plugin.command.test(command)
          : Array.isArray(plugin.command)
          ? plugin.command.some(cmd => cmd instanceof RegExp ? cmd.test(command) : cmd === command)
          : typeof plugin.command === "string"
          ? plugin.command === command
          : false

        if (!isAccept) continue

const adminMode = chat.modoadmin || false
const wa =
  plugin.botAdmin ||
  plugin.admin ||
  plugin.group ||
  plugin ||
  noPrefix ||
  pluginPrefix ||
  m.text.slice(0, 1) === pluginPrefix ||
  plugin.command

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

        m.plugin = name
        m.isCommand = true
        m.exp += plugin.exp ? parseInt(plugin.exp) : 10

        try {
          await plugin.call(this, m, {
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
            isOwner,
            isRAdmin,
            isAdmin,
            isBotAdmin,
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
    }

  } catch (err) {
    console.error(err)
  }
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