require("dotenv").config()
const ON_DEATH = require("death")
const wa = require("@open-wa/wa-automate")
const fs = require("fs")
const wakeDyno = require("woke-dyno")
var AWS = require("aws-sdk")

const server = require("./server")
const bot = require("./bot/index.js")

const PORT = process.env.PORT || 8080
let globalClient

var s3 = new AWS.S3()
s3.getObject(
  { Bucket: process.env.S3_BUCKET_NAME, Key: "session1.data.json" },
  function (error, data) {
    if (error != null) {
      console.log("Failed to retrieve an object: " + error)
    } else {
      console.log("Loaded " + data.ContentLength + " bytes")
      if (process.env.NODE_ENV === "production") {
        fs.promises.mkdir("./static", { recursive: true }).then(() =>
          fs.promises.writeFile(
            "./static/session1.data.json",
            JSON.stringify(JSON.parse(data.Body)),
            function (err) {
              if (err) return console.log(err)
            }
          )
        )
      }
    }
    wa.create({
      sessionId: "session1",
      sessionDataPath: "static",
      headless: process.env.NODE_ENV === "development" ? false : true,
      throwErrorOnTosBlock: true,
      restartOnCrash: bot.start,
      killProcessOnBrowserClose: false,
      autoRefresh: false,
      qrRefreshS: 15,
      qrTimeout: 40,
      cacheEnabled: false,
      customUserAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3882.0 Safari/537.36",
    })
      .then(async (client) => await bot.start(client))
      .catch((e) => {
        console.log("Error", e.message)
      })
  }
)

server.listen(PORT, () => {
  wakeDyno(process.env.DYNO_URL).start()
})

ON_DEATH(async function (signal, err) {
  console.log("killing session")
  console.log(signal)
  console.log(err)
  if (globalClient) await globalClient.kill()
})

wa.ev.on("qr.**", async (qrcode, sessionId) => {
  const imageBuffer = Buffer.from(
    qrcode.replace("data:image/png;base64,", ""),
    "base64"
  )
  fs.promises
    .mkdir("./static", { recursive: true })
    .then(() =>
      fs.writeFileSync(
        `static/qr_code${sessionId ? "_" + sessionId : ""}.png`,
        imageBuffer
      )
    )
})

wa.ev.on("sessionData.**", async (sessionData, sessionId) => {
  if (process.env.NODE_ENV === "production") {
    const params = {
      Bucket: process.env.S3_BUCKET_NAME,
      Key: `${sessionId ? sessionId : ""}.data.json`,
      Body: JSON.stringify(sessionData, null, 2),
    }
    s3.upload(params, function (s3Err, data) {
      if (s3Err) throw s3Err
      console.log(`File uploaded successfully at ${data.Location}`)
    })
  }
})
