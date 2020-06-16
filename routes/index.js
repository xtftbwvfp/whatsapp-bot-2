const { Router } = require("express")
var path = require("path")
const router = Router()

router.get("/", function (request, response) {
  response.sendFile(path.join(__dirname + "/../views/login.html"))
})

router.post("/auth", function (req, res) {
  var id = req.body.u
  var pw = req.body.p
  if (id == "evercam" && pw == process.env.LOG_PASSWORD) {
    res.sendFile(path.join(__dirname + "/../activity.log"))
  }
})

module.exports = router
