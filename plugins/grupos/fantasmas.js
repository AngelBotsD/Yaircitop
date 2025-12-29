import fs from "fs"

const FILE = "./fantasmas.json"
const TIMEOUT = 3 * 24 * 60 * 60 * 1000

let db = {}

if (!fs.existsSync(FILE)) {
  fs.writeFileSync(FILE, JSON.stringify({}, null, 2))
}

try {
  db = JSON.parse(fs.readFileSync(FILE))
} catch {
  db = {}
}

function save() {
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2))
}

export async function initFantasma(conn) {
  conn.ev.on("messages.upsert", async ({ messages }) => {
    const m = messages[0]
    if (!m?.message) return
    if (!m.key.remoteJid.endsWith("@g.us")) return
    if (m.key.fromMe) return

    const groupJid = m.key.remoteJid
    const sender = m.key.participant
    if (!sender) return

    const metadata = await conn.groupMetadata(groupJid)
    const participant = metadata.participants.find(p => p.id === sender)

    if (!participant) return
    if (participant.admin) return
    if (sender === conn.user.id.split(":")[0] + "@s.whatsapp.net") return

    if (!db[groupJid]) db[groupJid] = {}

    db[groupJid][sender] = {
      last: Date.now(),
      ghost: false
    }

    save()
  })

  setInterval(async () => {
    for (const groupJid in db) {
      const now = Date.now()
      for (const jid in db[groupJid]) {
        if (now - db[groupJid][jid].last >= TIMEOUT) {
          db[groupJid][jid].ghost = true
        }
      }
    }
    save()
  }, 60 * 60 * 1000)
}

function getGhosts(groupJid) {
  if (!db[groupJid]) return []
  return Object.entries(db[groupJid])
    .filter(([_, v]) => v.ghost)
    .map(([jid]) => jid)
}

export async function fankick(conn, groupJid) {
  const ghosts = getGhosts(groupJid)
  if (!ghosts.length) return 0
  await conn.groupParticipantsUpdate(groupJid, ghosts, "remove")
  return ghosts.length
}

const handler = async (m, { conn, isAdmin, isOwner, command }) => {
  if (!m.chat.endsWith("@g.us")) return

  if (command === "fantasmas") {
    const list = getGhosts(m.chat)
    if (!list.length) return m.reply("No hay fantasmas 👻")

    let txt = "👻 Usuarios Fantasmas\n\n"
    for (const jid of list) {
      txt += `• @${jid.split("@")[0]}\n`
    }

    return conn.sendMessage(m.chat, { text: txt, mentions: list })
  }

  if (command === "fankick") {
    if (!isAdmin && !isOwner) return
    const total = await fankick(conn, m.chat)
    if (!total) return m.reply("No hay fantasmas 👻")
    m.reply(`👻 ${total} fantasmas eliminados`)
  }
}

handler.command = ["fantasmas", "fankick"]
handler.group = true
handler.admin = true

export default handler