// backend/app.js

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.log(err));

// Example Route
app.get('/api/data', async (req, res) => {
    res.json({ message: 'Hello from backend!' });
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
