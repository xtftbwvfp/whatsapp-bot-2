const models = require("../models")
const { Op } = require("sequelize")

module.exports = {
  getUserOrCreate(params) {
    return new Promise((resolve, reject) => {
      models.users
        .findOrCreate({
          where: { phone_number: params.phone_number },
          defaults: {
            user_chat_id: params.user_chat_id,
            phone_number: params.phone_number,
            first_name: params.first_name,
            last_name: params.last_name,
            email: params.email,
          },
        })
        .then(([user, created]) => resolve(user))
        .catch((error) => reject(error))
    })
  },
  getByPhone(params) {
    return new Promise((resolve, reject) => {
      const { phone_number } = params
      models.users
        .findOne({
          where: { phone_number: phone_number },
        })
        .then((user) => resolve(user))
        .catch((error) => reject(error))
    })
  },
  getUser(user_chat_id) {
    return new Promise((resolve, reject) => {
      models.users
        .findOne({
          where: { user_chat_id: user_chat_id },
        })
        .then((user) => resolve(user))
        .catch((error) => reject(error))
    })
  },
  async getAllUsers() {
    try {
      const results = await models.users.findAll({
        where: {
          id: {
            [Op.not]: 2,
          },
        },
      })
      return results
    } catch (e) {
      console.log("error creating group:", e)
    }
  },
}
