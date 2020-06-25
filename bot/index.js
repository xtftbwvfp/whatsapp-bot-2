const fetch = require("node-fetch")
const { default: PQueue } = require("p-queue")

var evercam = require("../utils/evercam")
const whatsappDB = require("../database/controllers")
var utils = require("../utils")

let globalClient
let botjson = {}

const queue = new PQueue({
  concurrency: 4,
  autoStart: false,
})

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

const saveMessage = async (params) => {
  let user, group, message
  user = await whatsappDB.users.getUserOrCreate({
    user_chat_id: params.user,
    phone_number: params.telephone,
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
    })
    whatsappDB.message_recipients.create({
      user: null,
      group: group,
      message: message.id,
    })
  } else {
    whatsappDB.message_recipients.create({
      user: user,
      group: null,
      message: message.id,
    })
  }
  return { message, user }
}

const saveReply = async (params) => {
  let user, group, message
  user = await whatsappDB.users.getUser(params.userId)
  message = await whatsappDB.messages.create({
    message_body: params.text,
    parent_message_id: params.parent_message,
    creator: 2,
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
    })
    whatsappDB.message_recipients.create({
      user: null,
      group: group,
      message: message.id,
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

const saveSentMessage = async (params) => {
  let user, group, message
  user = await whatsappDB.users.getUser(params.user)
  message = await whatsappDB.messages.create({
    message_body: params.text,
    parent_message_id: null,
    creator: 2,
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
    })
    whatsappDB.message_recipients.create({
      user: null,
      group: group,
      message: message.id,
    })
  } else {
    whatsappDB.message_recipients.create({
      user: user,
      group: null,
      message: message.id,
    })
  }
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
    let dbResponse = await saveMessage(body)
    body.parent_message = dbResponse.message.id
    body.userId = dbResponse.user.user_chat_id
    if (!body.groupReply) {
      await globalClient.simulateTyping(body.user, false)
      return
    } else if (!credentials) {
      response = botjson.unAuthorized
      saveReply(body)
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
        saveReply(body)
        await globalClient
          .sendText(body.user, body.text)
          .then(async () => await globalClient.simulateTyping(body.user, false))
        return
      }
      if (PartialMatch != undefined) {
        body.text = PartialMatch.response
        saveReply(body)
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
                saveReply(body)
              })
              .catch((error) => {
                body.text = "live-error-" + camera.name
                saveReply(body)
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
          saveReply(body)
          await globalClient
            .sendText(body.user, body.text)
            .then(
              async () => await globalClient.simulateTyping(body.user, false)
            )
          break
        default:
          if (isNaN(parseInt(body.text))) {
            body.text = botjson.noMatch
            saveReply(body)
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
                saveReply(body)
                await globalClient.simulateTyping(body.user, false)
              })
              .catch(async (error) => {
                body.text = "live-error-" + camera.name
                saveReply(body)
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

module.exports = {
  async start(client) {
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
  },

  sendMessage(params) {
    globalClient.sendText(params.user, params.text)
    let body = {
      text: params.text,
      user: params.user,
      groupName: params.groupName,
      isGroupMsg: params.groupName ? true : false,
    }
    saveSentMessage(body)
  },
}