'use strict';
module.exports = (sequelize, DataTypes) => {
  const Order = sequelize.define('Order', {
    user_id: DataTypes.INTEGER,
    total_amount: DataTypes.DECIMAL(10, 2),
    status: {
      type: DataTypes.STRING,
      defaultValue: 'pending',
    }
  }, {
    tableName: 'orders',
    underscored: true,
  });

  Order.associate = function(models) {
    Order.belongsTo(models.User, {
      foreignKey: 'user_id',
      as: 'user'
    });

    Order.hasMany(models.OrderItem, {
      foreignKey: 'order_id',
      as: 'items'
    });
  };

  return Order;
};
