"use strict"

module.exports = {
  up: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.addColumn("users", "authenticated", {
        type: Sequelize.BOOLEAN,
        allowNull: true,
      }),
      queryInterface.addColumn("users", "private_chats", {
        type: Sequelize.BOOLEAN,
        allowNull: true,
      }),
    ])
  },

  down: (queryInterface, Sequelize) => {
    return Promise.all([
      queryInterface.removeColumn("users", "authenticated"),
      queryInterface.removeColumn("users", "private_chats"),
    ])
  },
}
