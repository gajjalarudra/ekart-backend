'use strict';
module.exports = (sequelize, DataTypes) => {
  const Product = sequelize.define('Product', {
    name: DataTypes.STRING,
    description: DataTypes.TEXT,
    price: DataTypes.DECIMAL(10, 2),
    stock: DataTypes.INTEGER
  }, {
    tableName: 'products',
    underscored: true,
  });

  Product.associate = function(models) {
    Product.hasMany(models.OrderItem, {
      foreignKey: 'product_id',
      as: 'order_items'
    });
  };

  return Product;
};
