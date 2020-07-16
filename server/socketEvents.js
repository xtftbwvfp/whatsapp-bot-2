module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("new connection -------------------")

    socket.on("message", function (message) {
      console.log(message)
    })
  })
}
