const express = require('express');
const db = require('./db');
const bodyParser = require('body-parser');
const routes = require('./routes');

const app = express();

// Use body-parser middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Include routes
app.use('/api', routes);

// ... Other application setup ...

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
