const models = require("../models")
const { Op } = require("sequelize")

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
  getMessagesByChat(user_id, group_id) {
    return new Promise((resolve, reject) => {
      let user = user_id ? user_id : null
      let group = group_id ? group_id : null
      models.message_recipients
        .findAll({
          // FIXME: limit messages to return
          order: [[models.sequelize.col("created_at"), "ASC"]],
          where: {
            [Op.and]: [{ recipient_id: user }, { recipient_group_id: group }],
          },
          include: [
            {
              model: models.messages,
              as: "message",
              include: [
                {
                  model: models.users,
                  as: "user",
                },
              ],
            },
          ],
        })
        .then((messages) => resolve(messages))
        .catch((error) => reject(error))
    })
  },
}
