'use strict';
module.exports = (sequelize, DataTypes) => {
  const User = sequelize.define('User', {
    name: DataTypes.STRING,
    email: {
      type: DataTypes.STRING,
      unique: true,
    },
    password: DataTypes.STRING
  }, {
    tableName: 'users',
    underscored: true,
  });

  User.associate = function(models) {
    User.hasMany(models.Order, {
      foreignKey: 'user_id',
      as: 'orders'
    });
  };

  return User;
};
