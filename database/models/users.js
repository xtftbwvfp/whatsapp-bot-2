"use strict"
module.exports = (sequelize, DataTypes) => {
  const Users = sequelize.define(
    "users",
    {
      user_chat_id: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      phone_number: DataTypes.STRING,
      first_name: DataTypes.STRING,
      last_name: DataTypes.STRING,
      email: DataTypes.STRING,
    },
    {
      underscored: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  )
  Users.associate = function (models) {
    Users.hasMany(models.messages, {
      foreignKey: "creator_id",
      as: "message",
      onDelete: "CASCADE",
    })

    Users.hasMany(models.message_recipients, {
      foreignKey: "recipient_id",
      as: "recipient",
      onDelete: "CASCADE",
    })

    Users.belongsToMany(models.groups, {
      foreignKey: "user_id",
      through: "users_groups",
      as: "groups",
    })
  }
  return Users
}
