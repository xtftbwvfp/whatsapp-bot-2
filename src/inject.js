WAPI.waitNewMessages(false, async (data) => {
  for (let i = 0; i < data.length; i++) {
    let message = data[i];
    let body = {};
    body.text = message.body;
    body.type = 'message';
    body.user = message.from._serialized;

    window.log(`Message from ${message.from.user} checking...`);
    if (message.type == "chat") {
      if (message.isGroupMsg == true && intents.appconfig.isGroupReply == false) {
        window.log("Message received in group and group reply is off. so will not take any actions.");
        var PartialMatch = message.body.toLowerCase().search(`@${intents.phone_number}`);
        if (PartialMatch == 0) {
          response = "Replying to a group"
          WAPI.sendSeen(message.from._serialized);
          WAPI.sendMessage2(message.from._serialized, response);
          return;
        } else {
          return;
        }
      }

      let credentials = await fetch(intents.evercam_url + "/users/whatsapp/%2B" + body.user.split("@")[0] + "/credentials?token=" + intents.token, {method: "get"})
      .then((resp) => resp.json()).then(function (response) {
        if (response.api_id && response.api_key) {
          return response
        } else {
          return false
        }
      }).catch(() => {
        return false
      });

      if (!credentials) {
        window.log("Contact not found: " + message.from.user);
        response = intents.unAuthorized
        WAPI.sendSeen(message.from._serialized);
        WAPI.sendMessage2(message.from._serialized, response);
      } else {
        var exactMatch = intents.bot.find(obj => obj.exact.find(ex => ex == message.body.toLowerCase()));
        var PartialMatch = intents.bot.find(obj => obj.contains.find(ex => message.body.toLowerCase().search(ex) > -1));
        var response = "";
        if (exactMatch != undefined) {
          response = await resolveSpintax(exactMatch.response);
          window.log(`Replying with ${response}`);
          WAPI.sendSeen(message.from._serialized);
          WAPI.sendMessage2(message.from._serialized, response);
          return;
        }
        if (PartialMatch != undefined) {
          response = await resolveSpintax(PartialMatch.response);
          window.log(`Replying with ${response}`);
          WAPI.sendSeen(message.from._serialized);
          WAPI.sendMessage2(message.from._serialized, response);
          return;
        }
        switch (message.body.toLowerCase()) {
          case "live":
					case "a":
						await fetch(intents.evercam_url + "/cameras?api_id=" + credentials.api_id + "&api_key=" + credentials.api_key, {method: "get"})
            .then((resp) => resp.json()).then(function (response) {
              const toDataURL = url => fetch(url)
                .then(response => response.blob())
                .then(blob => new Promise((resolve, reject) => {
                  const reader = new FileReader()
                  reader.onloadend = () => resolve(reader.result)
                  reader.onerror = reject
                  reader.readAsDataURL(blob)
                }))
              response.cameras.forEach(element => {
                let url = element.is_online ? intents.evercam_url + "/cameras/" + element.id + "/live/snapshot" : element.thumbnail_url 
                toDataURL(url + "?api_id=" + credentials.api_id + "&api_key=" + credentials.api_key)
                  .then(dataUrl => {
                    WAPI.sendSeen(message.from._serialized);
                    WAPI.sendImage(dataUrl, message.from._serialized, element.id + ".png", element.name);
                    window.log("Sending live view image of camera '" + element.name + "' to '" + message.from.user);
                  }).catch(error => {
                    WAPI.sendSeen(message.from._serialized);
                    WAPI.sendMessage2(message.from._serialized, element.name + ": " + error.message);
                    window.log("Sending error getting live view image of camera '" + element.name + ": " + error.message);
                  });
              });
            }).catch(() => {
              window.log("Contact not found: " + message.from.user);
              response = intents.unAuthorized
              WAPI.sendSeen(message.from._serialized);
              WAPI.sendMessage2(message.from._serialized, response);
            });
						break;
					case "b":
						response = await fetch(intents.evercam_url + "/cameras?api_id=" + credentials.api_id + "&api_key=" + credentials.api_key, {
							method: "GET"
						}).then((resp) => resp.json()).then(function (r) {
              var res = "Select a camera by replying the associated number:\n"
              r.cameras.forEach((element, index) => {
                res += `\n *${index + 1}.* ${element.name}`
              });
              return res
						}).catch(function (error) {
							console.log(error);
						});
            window.log(`Replying with ${response}`);
            WAPI.sendSeen(message.from._serialized);
            WAPI.sendMessage2(message.from._serialized, response);
						break;
					default:
						if (isNaN(parseInt(message.body))) {
              response = await resolveSpintax(intents.noMatch);
              window.log(`Replying with ${response}`);
              WAPI.sendSeen(message.from._serialized);
              WAPI.sendMessage2(message.from._serialized, response);
						} else {
              await fetch(intents.evercam_url + "/cameras?api_id=" + credentials.api_id + "&api_key=" + credentials.api_key, {method: "get"})
              .then((resp) => resp.json()).then(function (response) {
                const toDataURL = url => fetch(url)
                  .then(response => response.blob())
                  .then(blob => new Promise((resolve, reject) => {
                    const reader = new FileReader()
                    reader.onloadend = () => resolve(reader.result)
                    reader.onerror = reject
                    reader.readAsDataURL(blob)
                  }))

                var camera = response.cameras[parseInt(message.body) - 1]
                let url = camera.is_online ? intents.evercam_url + "/cameras/" + camera.id + "/live/snapshot" : camera.thumbnail_url 
                toDataURL(url + "?api_id=" + credentials.api_id + "&api_key=" + credentials.api_key)
                .then(dataUrl => {
                  WAPI.sendSeen(message.from._serialized);
                  WAPI.sendImage(dataUrl, message.from._serialized, camera.id + ".png", camera.name);
                  window.log("Sending live view image of camera '" + camera.name + "' to '" + message.from.user);
                }).catch(error => {
                  WAPI.sendSeen(message.from._serialized);
                  WAPI.sendMessage2(message.from._serialized, camera.name + ": " + error.message);
                  window.log("Sending error getting live view image of camera '" + camera.name + ": " + error.message);
                });
              }).catch(() => {
                window.log("Camera not found: " + message.from.user);
                response = "Camera not found"
                WAPI.sendSeen(message.from._serialized);
                WAPI.sendMessage2(message.from._serialized, response);
              });
						}
						break;
				}
      }
    }
  }
});