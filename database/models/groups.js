"use strict"
module.exports = (sequelize, DataTypes) => {
  const Groups = sequelize.define(
    "groups",
    {
      group_chat_id: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      name: DataTypes.STRING,
    },
    {
      underscored: true,
      createdAt: "created_at",
      updatedAt: "updated_at",
    }
  )
  Groups.associate = function (models) {
    Groups.belongsToMany(models.users, {
      foreignKey: "group_id",
      through: "users_groups",
      as: "users",
    })
  }
  return Groups
}
