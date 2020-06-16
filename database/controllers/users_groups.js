const models = require("../models")
const { Op } = require("sequelize")

module.exports = {
  getParciticipantOrcreate(params) {
    return new Promise((resolve, reject) => {
      models.users_groups
        .findOrCreate({
          where: {
            [Op.and]: [
              { user_id: params.user_id },
              { group_id: params.group_id },
            ],
          },
          defaults: {
            user_id: params.user_id,
            group_id: params.group_id,
          },
        })
        .then(([users_groups, created]) => resolve(users_groups))
        .catch((error) => reject(error))
    })
  },
}
