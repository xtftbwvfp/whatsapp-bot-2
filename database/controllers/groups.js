const models = require("../models")

module.exports = {
  getGroupOrCreate(params) {
    return new Promise((resolve, reject) => {
      models.groups
        .findOrCreate({
          where: { group_chat_id: params.group_chat_id },
          defaults: {
            group_chat_id: params.group_chat_id,
            name: params.name,
          },
        })
        .then(([group, created]) => resolve(group))
        .catch((error) => reject(error))
    })
  },
}
