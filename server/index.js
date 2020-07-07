const express = require("express")
const bodyParser = require("body-parser")
var cors = require("cors")

const auth = require("../middleware/auth.js")
const routes = require("../routes")

const server = express()
server.use(express.json())
server.use(cors())
server.use(auth.authenticateToken)
server.use(bodyParser.urlencoded({ extended: true }))
server.use(bodyParser.json())
server.use("/", routes)

module.exports = server
