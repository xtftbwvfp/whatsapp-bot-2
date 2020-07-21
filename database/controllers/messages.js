const models = require("../models")
const { Op } = require("sequelize")

module.exports = {
  create(params) {
    return new Promise((resolve, reject) => {
      models.messages
        .create({
          message_body: params.message_body,
          parent_message_id: params.parent_message_id,
          creator_id: params.creator,
          type: params.type,
          flow: params.flow,
        })
        .then((message) => resolve(message))
        .catch((error) => reject(error))
    })
  },
  getFlow(user_id, group_id) {
    return new Promise((resolve, reject) => {
      let user = user_id ? user_id : null
      let group = group_id ? group_id : null
      models.messages
        .findAll({
          limit: 1,
          where: {
            [Op.and]: [
              { "$message_id.recipient_id$": user },
              { "$message_id.recipient_group_id$": group },
              { creator_id: 2 },
            ],
          },
          include: [
            {
              model: models.message_recipients,
              as: "message_id",
              duplicating: false,
            },
          ],
          order: [[models.sequelize.col("created_at"), "DESC"]],
        })
        .then((message) => resolve(message))
        .catch((error) => reject(error))
    })
  },
}
