const models = require("../models")

module.exports = {
  create(params) {
    return new Promise((resolve, reject) => {
      models.messages
        .create({
          message_body: params.message_body,
          parent_message_id: params.parent_message_id,
          creator_id: params.creator,
          type: params.type,
        })
        .then((message) => resolve(message))
        .catch((error) => reject(error))
    })
  },
}
