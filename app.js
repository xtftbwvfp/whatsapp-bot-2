require("dotenv").config()
const ON_DEATH = require("death")
const wa = require("@open-wa/wa-automate")
const fs = require("fs")
const fetch = require("node-fetch")
const { default: PQueue } = require("p-queue")
const wakeDyno = require("woke-dyno")

var utils = require("./utils")
const server = require("./server")
var evercam = require("./utils/evercam")
const whatsappDB = require("./database/controllers")

const PORT = process.env.PORT || 3000
let globalClient
let botjson = {}

const queue = new PQueue({
  concurrency: 4,
  autoStart: false,
})

server.listen(PORT, () => {
  wakeDyno(process.env.DYNO_URL).start()
})

ON_DEATH(async function (signal, err) {
  console.log("killing session")
  console.log(signal)
  console.log(err)
  if (globalClient) await globalClient.kill()
})

wa.create({
  sessionId: "session1",
  sessionDataPath: "static",
  headless: process.env.NODE_ENV === "development" ? false : true,
  throwErrorOnTosBlock: true,
  restartOnCrash: start,
  killProcessOnBrowserClose: false,
  autoRefresh: false,
  qrRefreshS: 15,
  qrTimeout: 40,
  cacheEnabled: false,
  customUserAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3882.0 Safari/537.36",
})
  .then(async (client) => await start(client))
  .catch((e) => {
    console.log("Error", e.message)
    // process.exit();
  })

wa.ev.on("qr.**", async (qrcode, sessionId) => {
  const imageBuffer = Buffer.from(
    qrcode.replace("data:image/png;base64,", ""),
    "base64"
  )
  fs.writeFileSync(
    `static/qr_code${sessionId ? "_" + sessionId : ""}.png`,
    imageBuffer
  )
})

wa.ev.on("sessionData.**", async (sessionData, sessionId) => {
  console.log("\n----------")
  console.log("sessionData", sessionId, sessionData)
  console.log("----------")
})

async function start(client) {
  globalClient = client
  const unreadMessages = await client.getAllUnreadMessages()
  unreadMessages.forEach(processMessage)
  client.onStateChanged(stateChanged)
  client.onAnyMessage(anyMessage)
  client.onMessage(processMessage)
  client.onBattery(batteryChanged)
  botjson = await utils.externalInjection("bot.json")
  botjson["evercam_url"] = process.env.EVERCAM_URL
  botjson["token"] = process.env.WHATSAPP_TOKEN
  botjson["phone_number"] = process.env.PHONE_NUMBER
  queue.start()
}

const processMessage = (message) => queue.add(() => onMessage(message))

const stateChanged = (state) => {
  console.log("state changed:", state)
  if (state === "CONFLICT") globalClient.forceRefocus()
}
const anyMessage = (message) => console.log(message.type)
const batteryChanged = (battery) => {
  if (battery == 20 || battery == 10 || battery == 5)
    globalClient.sendText(
      process.env.ADMIN_PHONE_NUMBER + "@c.us",
      "BATTERY CHANGED: " + battery
    )
}

const saveMessage = async (reply, params) => {
  let user, group, message
  user = await whatsappDB.users.getUserOrCreate({
    user_chat_id: params.user,
    phone_number: reply ? process.env.PHONE_NUMBER : params.telephone,
    first_name: params.first_name,
    last_name: params.last_name,
    email: params.email,
  })
  message = await whatsappDB.messages.create({
    message_body: params.text,
    parent_message_id: params.parent_message,
    creator: user.id,
  })
  if (params.isGroupMsg == true) {
    group = await whatsappDB.groups.getGroupOrCreate({
      group_chat_id: params.user,
      name: params.groupName,
    })

    let participants = await globalClient.getGroupMembers(params.user)
    participants.forEach(async (element) => {
      let user = await whatsappDB.users.getUserOrCreate({
        user_chat_id: element.id,
        phone_number: element.id.split("@")[0],
        first_name: null,
        last_name: null,
        email: null,
      })
      await whatsappDB.users_groups.getParciticipantOrcreate({
        user_id: user.id,
        group_id: group.id,
      })
      whatsappDB.message_recipients.create({
        user: null,
        group: group,
        message: message.id,
      })
    })
  } else {
    whatsappDB.message_recipients.create({
      user: user,
      group: null,
      message: message.id,
    })
  }
  return message
}

const onMessage = async (message) => {
  try {
    let cameras = {}
    let body = {}
    body.text = message.body
    body.type = "message"
    body.user = message.from
    body.telephone = message.author
      ? message.author.split("@")[0]
      : message.from.split("@")[0]
    body.isGroupMsg = message.isGroupMsg
    body.groupReply = true

    globalClient.sendSeen(body.user)
    await globalClient.simulateTyping(body.user, true)

    if (body.isGroupMsg == true && botjson.appconfig.isGroupReply == false) {
      body.groupName = message.chat.formattedTitle
      var PartialMatch = body.text
        .toLowerCase()
        .search(`@${botjson.phone_number}`)
      if (PartialMatch >= 0) {
        body.text = message.body.replace(`@${botjson.phone_number}`, " ").trim()
      } else {
        body.groupReply = false
      }
    }

    let credentials = await evercam.getCredentials(body.telephone)
    body.first_name = credentials.firstname
    body.last_name = credentials.lastname
    body.email = credentials.email
    let messageDB = await saveMessage(false, body)
    body.parent_message = messageDB.id
    if (!body.groupReply) {
      await globalClient.simulateTyping(body.user, false)
      return
    } else if (!credentials) {
      response = botjson.unAuthorized
      saveMessage(true, body)
      await globalClient
        .sendText(body.user, response)
        .then(async () => await globalClient.simulateTyping(body.user, false))
    } else {
      var exactMatch = botjson.bot.find((obj) =>
        obj.exact.find((ex) => ex == body.text.toLowerCase())
      )
      PartialMatch = botjson.bot.find((obj) =>
        obj.contains.find((ex) => body.text.toLowerCase().search(ex) > -1)
      )
      var response = ""
      if (exactMatch != undefined) {
        body.text = exactMatch.response
        saveMessage(true, body)
        await globalClient
          .sendText(body.user, body.text)
          .then(async () => await globalClient.simulateTyping(body.user, false))
        return
      }
      if (PartialMatch != undefined) {
        body.text = PartialMatch.response
        saveMessage(true, body)
        await globalClient
          .sendText(body.user, body.text)
          .then(async () => await globalClient.simulateTyping(body.user, false))
        return
      }
      switch (body.text.toLowerCase()) {
        case "live":
        case "a":
          cameras = await evercam.camerasList(credentials)
          cameras.cameras.forEach(async (camera) => {
            let url = camera.is_online
              ? botjson.evercam_url + "/cameras/" + camera.id + "/live/snapshot"
              : camera.thumbnail_url
            url =
              url +
              "?api_id=" +
              credentials.api_id +
              "&api_key=" +
              credentials.api_key
            let img = await fetch(url)
              .then((r) => r.buffer())
              .then((buf) => {
                return "data:image/png;base64," + buf.toString("base64")
              })
            await globalClient
              .sendImage(body.user, img, camera.id + ".png", camera.name)
              .then(() => {
                body.text = "live-" + camera.name
                saveMessage(true, body)
              })
              .catch((error) => {
                body.text = "live-error-" + camera.name
                saveMessage(true, body)
                globalClient.sendText(
                  body.user,
                  camera.name + ": " + error.message
                )
              })
          })
          await globalClient.simulateTyping(body.user, false)
          break
        case "b":
          cameras = await evercam.camerasList(credentials)
          body.text = "Select a camera by replying the associated number:\n"
          cameras.cameras.forEach((camera, index) => {
            body.text += `\n *${index + 1}.* ${camera.name}`
          })
          saveMessage(true, body)
          await globalClient
            .sendText(body.user, body.text)
            .then(
              async () => await globalClient.simulateTyping(body.user, false)
            )
          break
        default:
          if (isNaN(parseInt(body.text))) {
            body.text = botjson.noMatch
            saveMessage(true, body)
            await globalClient
              .sendText(body.user, body.text)
              .then(
                async () => await globalClient.simulateTyping(body.user, false)
              )
          } else {
            cameras = await evercam.camerasList(credentials)
            var camera = cameras.cameras[parseInt(body.text) - 1]
            let url = camera.is_online
              ? botjson.evercam_url + "/cameras/" + camera.id + "/live/snapshot"
              : camera.thumbnail_url
            url =
              url +
              "?api_id=" +
              credentials.api_id +
              "&api_key=" +
              credentials.api_key
            let img = await fetch(url)
              .then((r) => r.buffer())
              .then((buf) => {
                return "data:image/png;base64," + buf.toString("base64")
              })
            await globalClient
              .sendImage(body.user, img, camera.id + ".png", camera.name)
              .then(async () => {
                body.text = "live-" + camera.name
                saveMessage(true, body)
                await globalClient.simulateTyping(body.user, false)
              })
              .catch(async (error) => {
                body.text = "live-error-" + camera.name
                saveMessage(true, body)
                await globalClient
                  .sendText(body.user, camera.name + ": " + error.message)
                  .then(
                    async () =>
                      await globalClient.simulateTyping(body.user, false)
                  )
              })
          }
          break
      }
    }
  } catch (error) {
    console.log("TCL: start -> error", error)
  }
}
