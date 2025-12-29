import { registrarFantasma, limpiarFantasmas } from "./lib/fantasmas.js"

let handler = async (m, { conn }) => {

  await registrarFantasma(m, conn)

  await limpiarFantasmas(conn)

  if (!/^\.fantasmas$/i.test(m.text || "")) return

  let gid = m.chat

  let lista = Object.keys(global.ghostDB[gid] || {})

  if (!lista.length) {
    return conn.reply(gid, "✨ No hay fantasmas", m)
  }

  let txt = "👻 LISTA DE FANTASMAS\n\n" +
    lista.map(v => "• @" + v.split("@")[0]).join("\n")

  await conn.sendMessage(gid, {
    text: txt,
    mentions: lista
  }, { quoted: m })
}

handler.command = ["fantasmas"]

export default handler