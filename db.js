const dotenv = require('dotenv');
dotenv.config();

const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGO_CONNECTION_STRING;

mongoose.connect(MONGODB_URI);

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB!');
});

module.exports = db;
