// backend/routes/searchResults.js

const express = require("express");
const { getSearchResults } = require("../controllers/searchController");

const router = express.Router();

router.post("/", getSearchResults);

module.exports = router;
