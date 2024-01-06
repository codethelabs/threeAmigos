// product.model.js
const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  supplier: {type:mongoose.Schema.Types.ObjectId, ref: "User" },
  name: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, required: true },
  category: { type: String, required: true },
  brand: { type: String, required: true },
  stockQuantity: { type: Number, required: true },
  ratings: [{ type: Number, min: 1, max: 5 }],
  reviews: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: 'User'},
      text: String,
      rating: { type: Number, min: 1, max: 5 },
    },
  ],
  images: [String],
  isFeatured: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
