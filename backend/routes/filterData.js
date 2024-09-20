// backend/routes/filterData.js

const express = require("express");
const { getAllFilterData } = require("../controllers/filterDataController");

const router = express.Router();

router.get("/", getAllFilterData);

module.exports = router;
