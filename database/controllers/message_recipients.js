const models = require("../models")

module.exports = {
  create(params) {
    return new Promise((resolve, reject) => {
      let user_id = params.user ? params.user.id : null
      let group_id = params.group ? params.group.id : null
      models.message_recipients
        .create({
          recipient_id: user_id,
          recipient_group_id: group_id,
          message_id: params.message,
        })
        .then((message_recipients) => resolve(message_recipients))
        .catch((error) => reject(error))
    })
  },
}
