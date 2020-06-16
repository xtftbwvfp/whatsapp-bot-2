const express = require("express")
const bodyParser = require("body-parser")
var path = require("path")

const routes = require("../routes")

const server = express()
server.use(express.json())

server.use("/", routes)
server.use(bodyParser.urlencoded({ extended: true }))
server.use(bodyParser.json())
server.set("views", path.join(__dirname, "views"))

module.exports = server