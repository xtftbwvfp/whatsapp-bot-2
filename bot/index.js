const fetch = require("node-fetch")
const { default: PQueue } = require("p-queue")
const dateFormat = require("date-fns/format")
const evercam = require("../utils/evercam")
const whatsappDB = require("../database/controllers")

let globalClient
const EVERCAM_URL = process.env.EVERCAM_URL
const PHONE_NUMBER = process.env.PHONE_NUMBER

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
  user = await whatsappDB.users
    .getUserOrCreate({
      user_chat_id: params.user,
      phone_number: params.telephone,
      first_name: params.first_name,
      last_name: params.last_name,
      email: params.email,
      private_chat: !params.isGroupMsg,
      authenticated: params.authenticated,
    })
    .then(async ([user, created]) => {
      if (!created && params.authenticated && !user.authenticated) {
        return await whatsappDB.users.update({
          user_chat_id: params.user,
          phone_number: params.telephone,
          first_name: params.first_name,
          last_name: params.last_name,
          email: params.email,
          private_chat: !params.isGroupMsg,
          authenticated: params.authenticated,
        })
      } else {
        return user
      }
    })
  message = await whatsappDB.messages.create({
    message_body: params.text,
    parent_message_id: params.parent_message,
    creator: user.id,
    type: params.type,
  })
  if (params.isGroupMsg == true) {
    group = await whatsappDB.groups.getGroupOrCreate({
      group_chat_id: params.user,
      name: params.groupName,
    })
    let participants = await globalClient.getGroupMembers(params.user)
    participants.forEach(async (element) => {
      let [participant, created] = await whatsappDB.users.getUserOrCreate({
        user_chat_id: element.id,
        phone_number: element.id.split("@")[0],
        first_name: null,
        last_name: null,
        email: null,
        private_chat: false,
        authenticated: false,
      })
      await whatsappDB.users_groups.getParciticipantOrcreate({
        user_id: participant.id,
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
    type: params.type,
    flow: params.flow,
  })
  if (params.isGroupMsg == true) {
    group = await whatsappDB.groups.getGroupOrCreate({
      group_chat_id: params.user,
      name: params.groupName,
    })

    let participants = await globalClient.getGroupMembers(params.user)
    participants.forEach(async (element) => {
      let [participant, created] = await whatsappDB.users.getUserOrCreate({
        user_chat_id: element.id,
        phone_number: element.id.split("@")[0],
        first_name: null,
        last_name: null,
        email: null,
        private_chat: false,
        authenticated: false,
      })
      await whatsappDB.users_groups.getParciticipantOrcreate({
        user_id: participant.id,
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
    type: params.type,
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
        private_chat: false,
        authenticated: false,
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
    let body = {}
    let credentials = null
    body.text = message.body
    body.type = "message"
    body.user = message.from
    body.telephone = message.author
      ? message.author.split("@")[0]
      : message.from.split("@")[0]
    body.isGroupMsg = message.isGroupMsg
    body.groupReply = true
    body.type = message.type

    globalClient.sendSeen(body.user)
    await globalClient.simulateTyping(body.user, true)

    if (body.isGroupMsg == true) {
      body.groupName = message.chat.formattedTitle
      var PartialMatch = body.text.toLowerCase().search(`@${PHONE_NUMBER}`)
      if (PartialMatch >= 0) {
        body.text = message.body.replace(`@${PHONE_NUMBER}`, " ").trim()
        credentials = await evercam.getCredentials(body.telephone)
      } else {
        body.groupReply = false
      }
    } else {
      credentials = await evercam.getCredentials(body.telephone)
    }
    if (credentials) {
      body.first_name = credentials.firstname
      body.last_name = credentials.lastname
      body.email = credentials.email
      body.authenticated = true
    }
    let dbResponse = await saveMessage(body)
    body.parent_message = dbResponse.message.id
    body.userId = dbResponse.user.user_chat_id
    if (!body.groupReply) {
      await globalClient.simulateTyping(body.user, false)
      return
    } else if (!credentials) {
      sendUnauthorized(body, globalClient)
    } else {
      switch (body.text.toLowerCase()) {
        case "hi":
        case "hello":
        case "menu":
        case "exit":
          evercamFlow(body, globalClient)
          // firstMessageFlow(body, globalClient)
          return
        case "live":
        case "live view":
          sendAllLiveView(credentials, body, globalClient)
          return
        default:
          break
      }
      let user_id = dbResponse.user ? dbResponse.user.id : null
      let group_id = dbResponse.group ? dbResponse.group.id : null
      let flow = await whatsappDB.messages.getFlow(user_id, group_id)
      if (flow[0].flow == 3 || flow[0].flow == 4) {
        var { cameras } = await evercam.camerasList(credentials)
        var bodyNumber = parseInt(body.text)
      }
      switch (flow[0].flow) {
        case 1:
          if (body.text.toLowerCase() == "a") {
            evercamFlow(body, globalClient)
            break
          } else if (body.text.toLowerCase() == "b") {
            procoreAlbumsFlow(body, globalClient)
            break
          } else {
            firstMessageFlow(body, globalClient)
            break
          }
        case 2:
          if (body.text.toLowerCase() == "a") {
            // Send all images live view
            sendAllLiveView(credentials, body, globalClient)
            break
          } else if (body.text.toLowerCase() == "b") {
            // Send select camera option for live view
            singleCameraFlow(false, credentials, body, globalClient)
            break
          } else if (body.text.toLowerCase() == "c") {
            // Send select camera option for gate report
            singleCameraFlow(true, credentials, body, globalClient)
            break
          } else {
            // Option on found, send evercam options
            evercamFlow(body, globalClient)
            break
          }
        case 3:
          // Single camera live view flow
          if (
            isNaN(bodyNumber) ||
            bodyNumber <= 0 ||
            bodyNumber > cameras.length
          ) {
            singleCameraFlow(false, credentials, body, globalClient)
            break
          } else {
            sendSingleLiveView(credentials, body, globalClient)
            break
          }
        case 4:
          if (
            isNaN(bodyNumber) ||
            bodyNumber <= 0 ||
            bodyNumber > cameras.length
          ) {
            singleCameraFlow(true, credentials, body, globalClient)
            break
          } else {
            sendGateReport(credentials, body, globalClient)
            break
          }
        case 5:
          if (isNaN(parseInt(body.text))) {
            procoreAlbumsFlow(body, globalClient)
            break
          } else {
            procoreImagesFlow(body, globalClient)
            break
          }
        case 6:
          if (isNaN(parseInt(body.text))) {
            procoreImagesFlow(body, globalClient)
            break
          } else {
            sendProcoreImage(body, globalClient)
            break
          }
        default:
          evercamFlow(body, globalClient)
          // firstMessageFlow(body, globalClient)
          break
      }
    }
  } catch (error) {
    console.log("TCL: start -> error", error)
  }
}

const sendUnauthorized = async (body, globalClient) => {
  body.text =
    "Sorry, you are not registered in our system. Please go to https://evercam.io or contact Vinnie (vinnie@evercam.io) to start enjoyng Evercam."
  body.type = "chat"
  body.flow = 0
  saveReply(body)
  await globalClient
    .sendText(body.user, body.text)
    .then(async () => await globalClient.simulateTyping(body.user, false))
}

const firstMessageFlow = async (body, globalClient) => {
  body.text =
    "*Hi " +
    body.first_name +
    "! Welcome to Evercam WhatsApp bot*\n\nReply with a letter to get the latest information from your account:\n\n  *A)* Evercam\n  *B)* Procore"
  body.type = "chat"
  body.flow = 1
  saveReply(body)
  await globalClient
    .sendText(body.user, body.text)
    .then(async () => await globalClient.simulateTyping(body.user, false))
}

const evercamFlow = async (body, globalClient) => {
  // let title = "*Evercam Menu*\n\n"
  body.text =
    "*Hi " +
    body.first_name +
    "! Welcome to Evercam WhatsApp bot*\n\nReply with a letter to get the latest information from your account:\n\n  *A)* All cameras Live View\n  *B)* Specific camera Live view\n  *C)* Gate Report"
  body.type = "chat"
  body.flow = 2
  saveReply(body)
  await globalClient
    .sendText(body.user, body.text)
    .then(async () => await globalClient.simulateTyping(body.user, false))
}

const singleCameraFlow = async (
  gate_report,
  credentials,
  body,
  globalClient
) => {
  var { cameras } = await evercam.camerasList(credentials)
  const title = gate_report ? "*Gate Report*\n\n" : "*Live View*\n\n"
  body.text =
    title + "Select a camera by replying with the associated number:\n"

  cameras.forEach((camera, index) => {
    body.text += `\n *${index + 1}.* ${camera.name}`
  })
  body.type = "chat"
  body.flow = gate_report ? 4 : 3
  saveReply(body)
  await globalClient
    .sendText(body.user, body.text)
    .then(async () => await globalClient.simulateTyping(body.user, false))
}

const procoreAlbumsFlow = async (body, globalClient) => {
  // TODO: Implement send procore albums
  let text = "Hi, Your procore daily logs 📑\n\n"

  text += "👷 *Manpower*\n"
  text += "\t 3 Workers | 24 Total Hours"
  text += "\n\n"

  text += "📃 *Notes*\n"
  text +=
    "\t - Evercam Office (IE)>00 | Progress going well, all facade panels installed."
  text += "\t - Evercam Office (IE)>00 | Crack in facade EV002."
  text += "\n\n"

  body.text = text
  body.type = "chat"
  body.flow = 0
  saveReply(body)
  await globalClient
    .sendText(body.user, body.text)
    .then(async () => await globalClient.simulateTyping(body.user, false))
}

const procoreImagesFlow = async (body, globalClient) => {
  // TODO: Send procore images in an album
  const title = "*Procore Image Selection*\n\n"
  body.text = title + "(Reply with a number associated to the image)"
  body.type = "chat"
  body.flow = 6
  saveReply(body)
  await globalClient
    .sendText(body.user, body.text)
    .then(async () => await globalClient.simulateTyping(body.user, false))
}

const sendAllLiveView = async (credentials, body, globalClient) => {
  const cameras = await evercam.camerasList(credentials)
  cameras.cameras.forEach(async (camera) => {
    let url = camera.is_online
      ? EVERCAM_URL + "/cameras/" + camera.id + "/live/snapshot"
      : camera.thumbnail_url
    url =
      url + "?api_id=" + credentials.api_id + "&api_key=" + credentials.api_key
    let img = await fetch(url)
      .then((r) => r.buffer())
      .then((buf) => {
        return "data:image/png;base64," + buf.toString("base64")
      })
    await globalClient
      .sendImage(body.user, img, camera.id + ".png", camera.name)
      .then(() => {
        body.text = "live-" + camera.name
        body.type = "image"
        body.flow = 0
        saveReply(body)
      })
      .catch((error) => {
        body.text = "live-error-" + camera.name
        body.flow = 0
        saveReply(body)
        globalClient.sendText(body.user, camera.name + ": " + error.message)
      })
  })
  await globalClient.simulateTyping(body.user, false)
}

const sendSingleLiveView = async (credentials, body, globalClient) => {
  const cameras = await evercam.camerasList(credentials)
  var camera = cameras.cameras[parseInt(body.text) - 1]
  let url = camera.is_online
    ? EVERCAM_URL + "/cameras/" + camera.id + "/live/snapshot"
    : camera.thumbnail_url
  url =
    url + "?api_id=" + credentials.api_id + "&api_key=" + credentials.api_key
  let img = await fetch(url)
    .then((r) => r.buffer())
    .then((buf) => {
      return "data:image/png;base64," + buf.toString("base64")
    })
  await globalClient
    .sendImage(body.user, img, camera.id + ".png", camera.name)
    .then(async () => {
      body.text = "live-" + camera.name
      body.type = "image"
      body.flow = 0
      saveReply(body)
      await globalClient.simulateTyping(body.user, false)
    })
    .catch(async (error) => {
      body.text = "live-error-" + camera.name
      body.type = "chat"
      body.flow = 0
      saveReply(body)
      await globalClient
        .sendText(body.user, camera.name + ": " + error.message)
        .then(async () => await globalClient.simulateTyping(body.user, false))
    })
}

const sendGateReport = async (credentials, body, globalClient) => {
  await globalClient.simulateTyping(body.user, false)

  var cameras = await evercam.camerasList(credentials)
  var camera = cameras.cameras[parseInt(body.text) - 1]

  try {
    let lastDate = await evercam.getLastGateReportDate(credentials, camera.id)
    let lastEvent = await evercam.getGateReportDetection(
      credentials,
      camera.id,
      lastDate
    )

    let arrived = await evercam.getArrivedThumbnail(credentials, lastEvent)
    let left = await evercam.getLeftThumbnail(credentials, lastEvent)

    let arrivedAt = new Date(lastEvent.arrived_time)
    let leftAt = new Date(lastEvent.left_time)

    // Spotted at
    body.text = `A ${lastEvent.truck_type} spotted at ${dateFormat(
      arrivedAt,
      "yyyy/MM/dd"
    )}`
    body.type = "chat"
    body.flow = 0
    saveReply(body)
    await globalClient
      .sendText(body.user, body.text)
      .then(async () => await globalClient.simulateTyping(body.user, false))

    // Thumpnails
    await globalClient.sendImage(
      body.user,
      arrived,
      camera.id + ".jpg",
      `Arrived at ${dateFormat(arrivedAt, "kk:mm:ss")}`
    )
    await globalClient.sendImage(
      body.user,
      left,
      camera.id + ".jpg",
      `Left at ${dateFormat(leftAt, "kk:mm:ss")}`
    )
  } catch (e) {
    body.text = `Sorry, no gate report available for the ${camera.name} camera`
    body.type = "chat"
    body.flow = 0
    saveReply(body)
    await globalClient
      .sendText(body.user, body.text)
      .then(async () => await globalClient.simulateTyping(body.user, false))
  }
}

const sendProcoreImage = async (body, globalClient) => {
  // TODO: Implement "send procore image"
  body.text = "send procore image"
  body.type = "chat"
  body.flow = 0
  saveReply(body)
  await globalClient
    .sendText(body.user, body.text)
    .then(async () => await globalClient.simulateTyping(body.user, false))
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
    queue.start()
  },

  sendMessage(params) {
    globalClient.sendText(params.user, params.text)
    let body = {
      text: params.text,
      user: params.user,
      groupName: params.groupName,
      isGroupMsg: params.groupName ? true : false,
      type: "chat",
    }
    saveSentMessage(body)
  },
}
