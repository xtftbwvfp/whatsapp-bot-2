"use strict"
module.exports = (sequelize, DataTypes) => {
  const Messages = sequelize.define(
    "messages",
    {
      message_body: DataTypes.TEXT,
      parent_message_id: DataTypes.INTEGER,
      creator_id: DataTypes.INTEGER,
      type: DataTypes.STRING,
    },
    {
      underscored: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  )
  Messages.associate = function (models) {
    Messages.hasMany(models.message_recipients, {
      foreignKey: "message_id",
      as: "message_id",
      onDelete: "CASCADE",
    })

    Messages.belongsTo(models.users, {
      foreignKey: "creator_id",
      as: "user",
      onDelete: "CASCADE",
    })

    Messages.hasMany(Messages, {
      as: "childrenMessageId",
      foreignKey: "id",
      onDelete: "CASCADE",
    })

    Messages.belongsTo(Messages, {
      as: "parentMessageId",
      foreignKey: "id",
      onDelete: "CASCADE",
    })
  }
  return Messages
}
