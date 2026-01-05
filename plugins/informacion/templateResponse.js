const {
  proto,
  generateWAMessage,
  areJidsSameUser
} = (await import('@whiskeysockets/baileys')).default

export async function all(m, chatUpdate) {
  if (m.isBaileys) return
  if (!m.message) return

  if (
    !m.message.buttonsResponseMessage &&
    !m.message.templateButtonReplyMessage &&
    !m.message.listResponseMessage
  ) return

  const id =
    m.message.buttonsResponseMessage?.selectedButtonId ||
    m.message.templateButtonReplyMessage?.selectedId ||
    m.message.listResponseMessage?.singleSelectReply?.selectedRowId

  const text =
    m.message.buttonsResponseMessage?.selectedDisplayText ||
    m.message.templateButtonReplyMessage?.selectedDisplayText ||
    m.message.listResponseMessage?.title

  let isIdMessage = false
  let usedPrefix = ""
  let finalText = text

  for (const name in global.plugins) {
    const plugin = global.plugins[name]
    if (!plugin || plugin.disabled) continue
    if (typeof plugin !== "function") continue
    if (!plugin.command) continue

    if (plugin.customPrefix) {
      if (plugin.customPrefix instanceof RegExp) {
        const match = id.match(plugin.customPrefix)
        if (!match) continue
        usedPrefix = match[0]
      } else if (typeof plugin.customPrefix === "string") {
        if (!id.startsWith(plugin.customPrefix)) continue
        usedPrefix = plugin.customPrefix
      }
    } else {
      const prefixes = Array.isArray(global.prefixes)
        ? global.prefixes
        : [global.prefix || "."]

      const found = prefixes.find(p =>
        typeof p === "string"
          ? id.startsWith(p)
          : p instanceof RegExp
            ? p.test(id)
            : false
      )

      if (!found) continue

      usedPrefix =
        found instanceof RegExp
          ? id.match(found)?.[0] || ""
          : found
    }

    const noPrefix = id.slice(usedPrefix.length)
    let [command] = noPrefix.trim().split(/\s+/)
    command = (command || "").toLowerCase()

    const isAccept =
      plugin.command instanceof RegExp
        ? plugin.command.test(command)
        : Array.isArray(plugin.command)
          ? plugin.command.some(cmd =>
              cmd instanceof RegExp ? cmd.test(command) : cmd === command
            )
          : plugin.command === command

    if (!isAccept) continue

    isIdMessage = true
    finalText = `${usedPrefix}${noPrefix}`
    break
  }

  const messages = await generateWAMessage(
    m.chat,
    {
      text: isIdMessage ? finalText : text,
      mentions: m.mentionedJid
    },
    {
      userJid: this.user.id,
      quoted: m.quoted && m.quoted.fakeObj
    }
  )

  messages.fromButton = true
  messages.key.fromMe = areJidsSameUser(m.sender, this.user.id)
  messages.key.id = m.key.id
  messages.pushName = m.name

  if (m.isGroup) {
    messages.key.participant = m.sender
  }

  const msg = {
    ...chatUpdate,
    messages: [
      proto.WebMessageInfo.fromObject(messages)
    ].map(v => (v.conn = this, v)),
    type: "append"
  }

  this.ev.emit("messages.upsert", msg)
}