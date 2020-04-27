/*global WAPI, intents, resolveSpintax*/

WAPI.waitNewMessages(false, async (data) => {
  for (let i = 0; i < data.length; i++) {
    let message = data[i]
    let body = {}
    body.text = message.body
    body.type = "message"
    body.user = message.from._serialized
    body.telephone = message.author ? message.author.user : message.from.user

    window.newMessage({
      user: message.from.user,
      server: message.from.server,
      message: body.text,
      date: Date.now(message.timestamp),
      type: "inbound",
    })

    window.log(`Message from ${message.from.user} checking...`)
    if (message.isGroupMsg == true && intents.appconfig.isGroupReply == false) {
      window.log(
        "Message received in group and group reply is off. so will not take any actions."
      )
      var PartialMatch = body.text
        .toLowerCase()
        .search(`@${intents.phone_number}`)
      if (PartialMatch >= 0) {
        body.text = message.body.replace(`@${intents.phone_number}`, " ").trim()
      } else {
        return
      }
    }

    let credentials = await fetch(
      intents.evercam_url +
        "/users/whatsapp/%2B" +
        body.telephone +
        "/credentials?token=" +
        intents.token,
      { method: "get" }
    )
      .then((resp) => resp.json())
      .then(function (response) {
        if (response.api_id && response.api_key) {
          return response
        } else {
          return false
        }
      })
      .catch(() => {
        return false
      })

    if (!credentials) {
      window.log("Contact not found: " + message.from.user)
      response = intents.unAuthorized
      WAPI.sendSeen(body.user)
      WAPI.sendMessage2(body.user, response)
      window.newMessage({
        user: message.from.user,
        server: message.from.server,
        message: response,
        date: Date.now(),
        type: "reply",
      })
    } else {
      var exactMatch = intents.bot.find((obj) =>
        obj.exact.find((ex) => ex == body.text.toLowerCase())
      )
      PartialMatch = intents.bot.find((obj) =>
        obj.contains.find((ex) => body.text.toLowerCase().search(ex) > -1)
      )
      var response = ""
      if (exactMatch != undefined) {
        response = await resolveSpintax(exactMatch.response)
        window.log(`Replying with ${response}`)
        WAPI.sendSeen(body.user)
        WAPI.sendMessage2(body.user, response)
        window.newMessage({
          user: message.from.user,
          server: message.from.server,
          message: response,
          date: Date.now(),
          type: "reply",
        })
        return
      }
      if (PartialMatch != undefined) {
        response = await resolveSpintax(PartialMatch.response)
        window.log(`Replying with ${response}`)
        WAPI.sendSeen(body.user)
        WAPI.sendMessage2(body.user, response)
        window.newMessage({
          user: message.from.user,
          server: message.from.server,
          message: response,
          date: Date.now(),
          type: "reply",
        })
        return
      }
      switch (body.text.toLowerCase()) {
        case "live":
        case "a":
          await fetch(
            intents.evercam_url +
              "/cameras?api_id=" +
              credentials.api_id +
              "&api_key=" +
              credentials.api_key,
            { method: "get" }
          )
            .then((resp) => resp.json())
            .then(function (response) {
              const toDataURL = (url) =>
                fetch(url)
                  .then((response) => response.blob())
                  .then(
                    (blob) =>
                      new Promise((resolve, reject) => {
                        const reader = new FileReader()
                        reader.onloadend = () => resolve(reader.result)
                        reader.onerror = reject
                        reader.readAsDataURL(blob)
                      })
                  )
              response.cameras.forEach((element) => {
                let url = element.is_online
                  ? intents.evercam_url +
                    "/cameras/" +
                    element.id +
                    "/live/snapshot"
                  : element.thumbnail_url
                toDataURL(
                  url +
                    "?api_id=" +
                    credentials.api_id +
                    "&api_key=" +
                    credentials.api_key
                )
                  .then((dataUrl) => {
                    WAPI.sendSeen(body.user)
                    WAPI.sendImage(
                      dataUrl,
                      body.user,
                      element.id + ".png",
                      element.name
                    )
                    window.newMessage({
                      user: message.from.user,
                      server: message.from.server,
                      message: dataUrl,
                      date: Date.now(),
                      type: "reply",
                    })
                    window.log(
                      "Sending live view image of camera '" +
                        element.name +
                        "' to '" +
                        message.from.user
                    )
                  })
                  .catch((error) => {
                    WAPI.sendSeen(body.user)
                    WAPI.sendMessage2(
                      body.user,
                      element.name + ": " + error.message
                    )
                    window.newMessage({
                      user: message.from.user,
                      server: message.from.server,
                      message: element.name + ": " + error.message,
                      date: Date.now(),
                      type: "reply",
                    })
                    window.log(
                      "Sending error getting live view image of camera '" +
                        element.name +
                        ": " +
                        error.message
                    )
                  })
              })
            })
            .catch(() => {
              window.log("Contact not found: " + message.from.user)
              response = intents.unAuthorized
              WAPI.sendSeen(body.user)
              WAPI.sendMessage2(body.user, response)
              window.newMessage({
                user: message.from.user,
                server: message.from.server,
                message: response,
                date: Date.now(),
                type: "reply",
              })
            })
          break
        case "b":
          response = await fetch(
            intents.evercam_url +
              "/cameras?api_id=" +
              credentials.api_id +
              "&api_key=" +
              credentials.api_key,
            {
              method: "GET",
            }
          )
            .then((resp) => resp.json())
            .then(function (r) {
              var res = "Select a camera by replying the associated number:\n"
              r.cameras.forEach((element, index) => {
                res += `\n *${index + 1}.* ${element.name}`
              })
              return res
            })
            .catch(function (error) {
              console.log(error)
            })
          window.log(`Replying with ${response}`)
          WAPI.sendSeen(body.user)
          WAPI.sendMessage2(body.user, response)
          window.newMessage({
            user: message.from.user,
            server: message.from.server,
            message: response,
            date: Date.now(),
            type: "reply",
          })
          break
        default:
          if (isNaN(parseInt(body.text))) {
            response = await resolveSpintax(intents.noMatch)
            window.log(`Replying with ${response}`)
            WAPI.sendSeen(body.user)
            WAPI.sendMessage2(body.user, response)
            window.newMessage({
              user: message.from.user,
              server: message.from.server,
              message: response,
              date: Date.now(),
              type: "reply",
            })
          } else {
            await fetch(
              intents.evercam_url +
                "/cameras?api_id=" +
                credentials.api_id +
                "&api_key=" +
                credentials.api_key,
              { method: "get" }
            )
              .then((resp) => resp.json())
              .then(function (response) {
                const toDataURL = (url) =>
                  fetch(url)
                    .then((response) => response.blob())
                    .then(
                      (blob) =>
                        new Promise((resolve, reject) => {
                          const reader = new FileReader()
                          reader.onloadend = () => resolve(reader.result)
                          reader.onerror = reject
                          reader.readAsDataURL(blob)
                        })
                    )

                var camera = response.cameras[parseInt(body.text) - 1]
                let url = camera.is_online
                  ? intents.evercam_url +
                    "/cameras/" +
                    camera.id +
                    "/live/snapshot"
                  : camera.thumbnail_url
                toDataURL(
                  url +
                    "?api_id=" +
                    credentials.api_id +
                    "&api_key=" +
                    credentials.api_key
                )
                  .then((dataUrl) => {
                    WAPI.sendSeen(body.user)
                    WAPI.sendImage(
                      dataUrl,
                      body.user,
                      camera.id + ".png",
                      camera.name
                    )
                    window.newMessage({
                      user: message.from.user,
                      server: message.from.server,
                      message: dataUrl,
                      date: Date.now(),
                      type: "reply",
                    })
                    window.log(
                      "Sending live view image of camera '" +
                        camera.name +
                        "' to '" +
                        message.from.user
                    )
                  })
                  .catch((error) => {
                    WAPI.sendSeen(body.user)
                    WAPI.sendMessage2(
                      body.user,
                      camera.name + ": " + error.message
                    )
                    window.newMessage({
                      user: message.from.user,
                      server: message.from.server,
                      message: camera.name + ": " + error.message,
                      date: Date.now(),
                      type: "reply",
                    })
                    window.log(
                      "Sending error getting live view image of camera '" +
                        camera.name +
                        ": " +
                        error.message
                    )
                  })
              })
              .catch(() => {
                window.log("Camera not found: " + message.from.user)
                response =
                  "Camera not found. Please reply with the number asociated to the camera. If you want to see the camera list, reply with the letter *B*"
                WAPI.sendSeen(body.user)
                WAPI.sendMessage2(body.user, response)
                window.newMessage({
                  user: message.from.user,
                  server: message.from.server,
                  message: response,
                  date: Date.now(),
                  type: "reply",
                })
              })
          }
          break
      }
    }
  }
})
