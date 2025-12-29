const TRES_DIAS = 1000 * 60 * 60 * 24 * 3

global.ghostDB = global.ghostDB || {}

export const registrarFantasma = async (m, conn) => {

  if (!m.isGroup) return

  let gid = m.chat
  let uid = m.sender
  let bot = conn.user.jid

  let meta = await conn.groupMetadata(gid)

  let user = meta.participants.find(v => v.id === uid)

  if (!user) return
  if (user.admin) return
  if (uid === bot) return

  if (!global.ghostDB[gid]) global.ghostDB[gid] = {}

  global.ghostDB[gid][uid] = Date.now()
}

export const limpiarFantasmas = async conn => {

  let ahora = Date.now()

  for (let gid in global.ghostDB) {

    let meta
    try {
      meta = await conn.groupMetadata(gid)
    } catch {
      delete global.ghostDB[gid]
      continue
    }

    let bot = conn.user.jid

    for (let uid in global.ghostDB[gid]) {

      let user = meta.participants.find(v => v.id === uid)

      if (!user) {
        delete global.ghostDB[gid][uid]
        continue
      }

      if (user.admin || uid === bot) {
        delete global.ghostDB[gid][uid]
        continue
      }

      let last = global.ghostDB[gid][uid]

      if (ahora - last >= TRES_DIAS) {
        delete global.ghostDB[gid][uid]
      }
    }
  }
}