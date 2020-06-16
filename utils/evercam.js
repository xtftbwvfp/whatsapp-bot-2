const fetch = require("node-fetch")

this.camerasList = function (credentials) {
  return new Promise((resolve, reject) => {
    fetch(
      process.env.EVERCAM_URL +
        "/cameras?api_id=" +
        credentials.api_id +
        "&api_key=" +
        credentials.api_key,
      {
        method: "GET",
      }
    )
      .then((resp) => resolve(resp.json()))
      .catch((error) => reject(error))
  })
}

this.getCredentials = function (telephone) {
  return new Promise((resolve) => {
    fetch(
      process.env.EVERCAM_URL +
        "/users/whatsapp/%2B" +
        telephone +
        "/credentials?token=" +
        process.env.WHATSAPP_TOKEN,
      { method: "get" }
    )
      .then((resp) => resp.json())
      .then(function (response) {
        if (response.api_id && response.api_key) {
          resolve(response)
        } else {
          resolve(false)
        }
      })
      .catch(() => {
        resolve(false)
      })
  })
}
