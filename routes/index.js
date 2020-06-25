const { Router } = require("express")
const router = Router()
const whatsappDB = require("../database/controllers")
const auth = require("../middleware/auth.js")
const bot = require("../bot/index.js")

router.post("/auth", function (req, res) {
  var id = req.body.u
  var pw = req.body.p
  if (id == "evercam" && pw == process.env.LOG_PASSWORD) {
    const token = auth.generateAccessToken({ username: id })
    res.json(token)
  } else {
    res.sendStatus(403)
  }
})

router.get("/chats", async function (req, res) {
  let groups = await whatsappDB.groups.getAllGroups({
    attributes: ["group_chat_id", "name"],
  })
  let users = await whatsappDB.users.getAllUsers({
    attributes: [
      "user_chat_id",
      "phone_number",
      "first_name",
      "last_name",
      "email",
    ],
  })
  res.json(users.concat(groups))
})

router.get("/messages", async function (req, res) {
  let messages = await whatsappDB.message_recipients.getMessagesByChat(
    req.query.user_id,
    req.query.group_id
  )
  res.json(messages)
})

router.post("/messages", async function (req, res) {
  bot.sendMessage(req.body)
  res.sendStatus(201)
})

module.exports = router
