const mongoose = require('mongoose');

async function connectDB(uri, opts = {}) {
  if (!uri) throw new Error('MONGO_URI is required');
  await mongoose.connect(uri, opts);
  return mongoose.connection;
}

async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

module.exports = { connectDB, disconnectDB };