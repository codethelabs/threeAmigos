const mongoose = require('mongoose');

const balance = new mongoose.Schema({
  
  date: {
    type: Date,
    default: Date.now,
  },
  totalAmount: {
    type: Number,
    default: 0,
  },
 
});

const Balance = mongoose.model('Balance', balance);

module.exports = Balance;
