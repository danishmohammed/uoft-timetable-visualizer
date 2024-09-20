// backend/routes/lastUpdated.js

const express = require("express");
const router = express.Router();
const { getLastUpdatedDate } = require("../controllers/lastUpdatedController");

router.get("/", getLastUpdatedDate);

module.exports = router;
