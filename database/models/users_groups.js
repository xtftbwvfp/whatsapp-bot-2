"use strict"
module.exports = (sequelize, DataTypes) => {
  const UserGroup = sequelize.define(
    "users_groups",
    {
      user_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      group_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
    },
    {
      underscored: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  )
  UserGroup.associate = function (models) {
    UserGroup.hasMany(models.message_recipients, {
      foreignKey: "recipient_group_id",
      as: "group_recipient",
      onDelete: "CASCADE",
    })

    UserGroup.belongsTo(models.users, {
      foreignKey: "user_id",
      as: "user",
      onDelete: "CASCADE",
    })

    UserGroup.belongsTo(models.groups, {
      foreignKey: "group_id",
      as: "group",
      onDelete: "CASCADE",
    })
  }
  return UserGroup
}
