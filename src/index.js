// import { create, Whatsapp } from "@open-wa/wa-automate"
const wa = require("@open-wa/wa-automate")
const fetch = require("node-fetch")
const ON_DEATH = require("death")
require("dotenv").config()
const { createLogger, transports, format } = require("winston")
const fs = require("fs")
const mime = require("mime-types")
const express = require("express")
const bodyParser = require("body-parser")
const mongoose = require("mongoose")
const path = require("path")
var evercam = require("./evercam")
var utils = require("./utils")

// const puppeteer = require("puppeteer-core")
// const _cliProgress = require("cli-progress")
// const spintax = require("mel-spintax")
// var spinner = require("./step")
// var utils = require("./utils")
// var qrcode = require("qrcode-terminal")
// var path = require("path")
// var argv = require("yargs").argv
// var rev = require("./detectRev")
// var constants = require("./constants")

const { combine, timestamp, json, simple } = format
const app = express()
const port = 3000
let globalClient
let botjson = {}

ON_DEATH(async function (signal, err) {
  console.log("killing session")
  if (globalClient) await globalClient.kill()
})

wa.create("session", {
  headless: false,
  throwErrorOnTosBlock: true,
  killTimer: 40,
  autoRefresh: true,
  qrRefreshS: 15,
  cacheEnabled: false,
}).then((client) => start(client))

wa.ev.on("qr.**", async (qrcode, sessionId) => {
  const imageBuffer = Buffer.from(
    qrcode.replace("data:image/png;base64,", ""),
    "base64"
  )
  fs.writeFileSync(
    `qr_code${sessionId ? "_" + sessionId : ""}.png`,
    imageBuffer
  )
})

wa.ev.on("sessionData", async (sessionData, sessionId) => {
  console.log(sessionId, sessionData)
})

mongoose.connect("mongodb://localhost/evercam", { useNewUrlParser: true, useUnifiedTopology: true })
//Get the default connection
var db = mongoose.connection

//Bind connection to error event (to get notification of connection errors)
const models = {}
db.on("error", console.error.bind(console, "MongoDB connection error:"))
db.once("open", function () {
  const Schema = mongoose.Schema
  var messagesSchema = new Schema({
    message: String,
    user: String,
    date: Date,
    type: String,
  })
  var usersSchema = new Schema({
    phone: String,
    created: { type: Date, default: Date.now },
  })
  // Compile model from schema
  models.Messages = mongoose.model("messages", messagesSchema)
  models.Users = mongoose.model("users", usersSchema)
})

const logger = createLogger({
  level: "info",
  format: combine(json(), timestamp()),
  transports: [
    new transports.File({ filename: "error.log", level: "error" }),
    new transports.File({ filename: "activity.log" }),
  ],
})

if (process.env.NODE_ENV !== "production") {
  logger.add(
    new transports.Console({
      format: simple(),
    })
  )
}

app.listen(port, () =>
  console.log(`Example app listening at http://localhost:${port}`)
)
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

app.get("/", function (request, response) {
  response.sendFile(path.join(__dirname + "/login.html"))
})

app.post("/auth", function (req, res) {
  var id = req.body.u
  var pw = req.body.p
  if (id == "evercam" && pw == process.env.LOG_PASSWORD) {
    res.sendFile(path.join(__dirname + "/../activity.log"))
  } else {
    logger.log("error", "Invalid credentials")
  }
})

const stateChanged = (state) => {
  console.log("state changed:", state)
  if (state === "CONFLICT") globalClient.forceRefocus()
}
const anyMessage = (message) => console.log(message.type)

async function start(client) {
  globalClient = client
  client.onStateChanged(stateChanged)
  client.onAnyMessage(anyMessage)
  client.onMessage(onMessage)
  botjson = await utils.externalInjection("bot.json")
  botjson["evercam_url"] = process.env.EVERCAM_URL
  botjson["token"] = process.env.WHATSAPP_TOKEN
  botjson["phone_number"] = process.env.PHONE_NUMBER
}

// const toDataURL = (url) =>
//   fetch(url)
//     .then((response) => response.blob())
//     .then(
//       (blob) =>
//         new Promise((resolve, reject) => {
//           const reader = new FileReader()
//           reader.onloadend = () => resolve(reader.result)
//           reader.onerror = reject
//           reader.readAsDataURL(blob)
//         })
//     )

const toDataURL = (url) =>
  fetch(url)
    .then((r) => r.buffer())
    .then(
      (buf) =>
        new Promise((resolve) => {
          resolve("data:image/png;base64," + buf.toString("base64"))
        })
    )

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

    // window.newMessage({
    //   user: message.from.user,
    //   server: message.from.server,
    //   message: body.text,
    //   date: Date.now(message.timestamp),
    //   type: "inbound",
    // })

    // window.log(`Message from ${message.from.user} checking...`)
    if (message.isGroupMsg == true && botjson.appconfig.isGroupReply == false) {
      // window.log(
      //   "Message received in group and group reply is off. so will not take any actions."
      // )
      var PartialMatch = body.text
        .toLowerCase()
        .search(`@${botjson.phone_number}`)
      if (PartialMatch >= 0) {
        body.text = message.body.replace(`@${botjson.phone_number}`, " ").trim()
      } else {
        return
      }
    }

    let credentials = await evercam.getCredentials(body.telephone)

    if (!credentials) {
      // window.log("Contact not found: " + message.from.user)
      response = botjson.unAuthorized
      // globalClient.sendSeen(body.user)
      globalClient.sendText(body.user, response)
      // window.newMessage({
      //   user: message.from.user,
      //   server: message.from.server,
      //   message: response,
      //   date: Date.now(),
      //   type: "reply",
      // })
    } else {
      var exactMatch = botjson.bot.find((obj) =>
        obj.exact.find((ex) => ex == body.text.toLowerCase())
      )
      PartialMatch = botjson.bot.find((obj) =>
        obj.contains.find((ex) => body.text.toLowerCase().search(ex) > -1)
      )
      var response = ""
      if (exactMatch != undefined) {
        response = exactMatch.response
        // window.log(`Replying with ${response}`)
        // globalClient.sendSeen(body.user)
        globalClient.sendText(body.user, response)
        // window.newMessage({
        //   user: message.from.user,
        //   server: message.from.server,
        //   message: response,
        //   date: Date.now(),
        //   type: "reply",
        // })
        return
      }
      if (PartialMatch != undefined) {
        response = PartialMatch.response
        // window.log(`Replying with ${response}`)
        // globalClient.sendSeen(body.user)
        globalClient.sendText(body.user, response)
        // window.newMessage({
        //   user: message.from.user,
        //   server: message.from.server,
        //   message: response,
        //   date: Date.now(),
        //   type: "reply",
        // })
        return
      }
      switch (body.text.toLowerCase()) {
        case "live":
        case "a":
          cameras = await evercam.camerasList(credentials)
          cameras.cameras.forEach(async (element) => {
            let url = element.is_online
              ? botjson.evercam_url +
                "/cameras/" +
                element.id +
                "/live/snapshot"
              : element.thumbnail_url
            url =
              url +
              "?api_id=" +
              credentials.api_id +
              "&api_key=" +
              credentials.api_key
            // toDataURL(
            //   url +
            //     "?api_id=" +
            //     credentials.api_id +
            //     "&api_key=" +
            //     credentials.api_key
            // )
            let img = await fetch(url)
              .then((r) => r.buffer())
              .then((buf) => {
                return "data:image/png;base64," + buf.toString("base64")
              })
            await globalClient.sendImage(
              body.user,
              img,
              element.id + ".png",
              element.name
            )
            // toDataURL(
            //   url +
            //     "?api_id=" +
            //     credentials.api_id +
            //     "&api_key=" +
            //     credentials.api_key
            // )
            //   .then((dataUrl) => {
            //     globalClient.sendImage(
            //       body.user,
            //       dataUrl,
            //       element.id + ".png",
            //       element.name
            //     )
            //     // window.newMessage({
            //     //   user: message.from.user,
            //     //   server: message.from.server,
            //     //   message: element.id,
            //     //   date: Date.now(),
            //     //   type: "reply",
            //     // })
            //     // window.log(
            //     //   "Sending live view image of camera '" +
            //     //     element.name +
            //     //     "' to '" +
            //     //     message.from.user
            //     // )
            //   })
            //   .catch((error) => {
            //     globalClient.sendText(
            //       body.user,
            //       element.name + ": " + error.message
            //     )
            //     // window.newMessage({
            //     //   user: message.from.user,
            //     //   server: message.from.server,
            //     //   message: element.name + ": " + error.message,
            //     //   date: Date.now(),
            //     //   type: "reply",
            //     // })
            //     // window.log(
            //     //   "Sending error getting live view image of camera '" +
            //     //     element.name +
            //     //     ": " +
            //     //     error.message
            //     // )
            //   })
          })
          break
        case "b":
          cameras = await evercam.camerasList(credentials)
          response = "Select a camera by replying the associated number:\n"
          cameras.cameras.forEach((element, index) => {
            response += `\n *${index + 1}.* ${element.name}`
          })
          // window.log(`Replying with ${response}`)
          globalClient.sendText(body.user, response)
          // window.newMessage({
          //   user: message.from.user,
          //   server: message.from.server,
          //   message: response,
          //   date: Date.now(),
          //   type: "reply",
          // })
          break
        default:
          if (isNaN(parseInt(body.text))) {
            response = botjson.noMatch
            // window.log(`Replying with ${response}`)
            globalClient.sendText(body.user, response)
            // window.newMessage({
            //   user: message.from.user,
            //   server: message.from.server,
            //   message: response,
            //   date: Date.now(),
            //   type: "reply",
            // })
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
            // toDataURL(
            //   url +
            //     "?api_id=" +
            //     credentials.api_id +
            //     "&api_key=" +
            //     credentials.api_key
            // )
            let img = await fetch(url)
              .then((r) => r.buffer())
              .then((buf) => {
                return "data:image/png;base64," + buf.toString("base64")
              })
            await globalClient
              .sendImage(body.user, img, camera.id + ".png", camera.name)
              // .then((dataUrl) => {
              //   // globalClient.sendSeen(body.user)
              //   globalClient.sendImage(
              //     dataUrl,
              //     body.user,
              //     camera.id + ".png",
              //     camera.name
              //   )
              //   // window.newMessage({
              //   //   user: message.from.user,
              //   //   server: message.from.server,
              //   //   message: camera.id,
              //   //   date: Date.now(),
              //   //   type: "reply",
              //   // })
              //   // window.log(
              //   //   "Sending live view image of camera '" +
              //   //     camera.name +
              //   //     "' to '" +
              //   //     message.from.user
              //   // )
              // })
              .catch((error) => {
                // globalClient.sendSeen(body.user)
                globalClient.sendText(body.user, camera.name + ": " + error.message)
                // window.newMessage({
                //   user: message.from.user,
                //   server: message.from.server,
                //   message: camera.name + ": " + error.message,
                //   date: Date.now(),
                //   type: "reply",
                // })
                // window.log(
                //   "Sending error getting live view image of camera '" +
                //     camera.name +
                //     ": " +
                //     error.message
                // )
              })
          }
          break
      }
    }
  } catch (error) {
    console.log("TCL: start -> error", error)
  }
}