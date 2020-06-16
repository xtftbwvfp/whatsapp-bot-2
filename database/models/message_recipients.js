"use strict"
module.exports = (sequelize, DataTypes) => {
  const MessageRecipient = sequelize.define(
    "message_recipients",
    {
      recipient_id: DataTypes.INTEGER,
      recipient_group_id: DataTypes.INTEGER,
      message_id: DataTypes.INTEGER,
    },
    {
      underscored: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  )
  MessageRecipient.associate = function (models) {
    MessageRecipient.belongsTo(models.messages, {
      foreignKey: "message_id",
      as: "message",
      onDelete: "CASCADE",
    })

    MessageRecipient.belongsTo(models.users, {
      foreignKey: "recipient_id",
      as: "user",
      onDelete: "CASCADE",
    })

    MessageRecipient.belongsTo(models.users_groups, {
      foreignKey: "recipient_group_id",
      as: "group",
      onDelete: "CASCADE",
    })
  }
  return MessageRecipient
}
