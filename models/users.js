// user.model.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firstname: { type: String, required: true },
  lastname: { type: String, required: true },
  phone: { type: String, required: true },
  address: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  supplier: { type: Boolean, required: true},
  staff: {type:Boolean, required: true},
  balance: {type: Number, default: 0.0}
});

const User = mongoose.model('User', userSchema);

module.exports = User;
