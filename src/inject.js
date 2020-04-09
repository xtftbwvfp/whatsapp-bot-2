WAPI.waitNewMessages(false, async (data) => {
  for (let i = 0; i < data.length; i++) {
    let message = data[i];
    let credentials
    let body = {};
    body.text = message.body;
    body.type = 'message';
    body.user = message.from._serialized;

    let authorized = await fetch(intents.evercam_url + "/users/whatsapp/+" + body.user.split("@")[0] + "/credentials?token=" + intents.token, {method: "get"})
      .then((resp) => resp.json()).then(function (response) {
        credentials = response
        return true
      }).catch(() => {
        return false
      });

    window.log(`Message from ${message.from.user} checking..`);
    if (message.type == "chat") {
      if (message.isGroupMsg == true && intents.isGroupReply == false) {
        window.log("Message received in group and group reply is off. so will not take any actions.");
        return;
      }
      if (!authorized) {
        window.log("Contact not found");
        response = "Sorry, you are not registered in our system. Please go to https://evercam.io or contact Vinnie (vinnie@evercam.io) to start enjoyng Evercam."
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
          response.cameras.forEach(element => {
            let url = element.is_online ? intents.evercam_url + "/cameras/" + element.id + "/live/snapshot" : element.thumbnail_url 
            toDataURL(url + "?api_id=" + credentials.api_id + "&api_key=" + credentials.api_key)
              .then(dataUrl => {
                WAPI.sendSeen(message.from._serialized);
                WAPI.sendImage(dataUrl, message.from._serialized, element.id + ".png", element.name);
              }).catch(error => {
                WAPI.sendSeen(message.from._serialized);
                WAPI.sendMessage2(message.from._serialized, element.name + ": " + error.message);
              });
          });
        }).catch(() => {
          window.log("Contact not found");
          response = "Sorry, you are not registered in our system. Please go to https://evercam.io or contact Vinnie (vinnie@evercam.io) to start enjoyng Evercam."
          WAPI.sendSeen(message.from._serialized);
          WAPI.sendMessage2(message.from._serialized, response);
        });
      }
    }
  }
});