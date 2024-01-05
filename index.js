const express = require('express');
const http = require('http');
const db = require('./db');
const bodyParser = require('body-parser');
const cors = require('cors');
const routes = require('./routes');
const path = require('path');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);

app.use(cors());

// Use body-parser middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


// Include routes
app.use('/api', routes);

// ... Other application setup ...

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
