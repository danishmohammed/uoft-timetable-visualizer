// backend/app.js

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const filterDataRoutes = require("./routes/filterData");
const searchResultsRoute = require("./routes/searchResults");
const lastUpdatedRoute = require("./routes/lastUpdated");

const app = express();
const port = process.env.PORT || 8000;

// Middleware
app.use(cors());
app.use(express.json());

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log(err));

app.use("/api/filterData", filterDataRoutes);
app.use("/api/searchResults", searchResultsRoute);
app.use("/api/lastUpdated", lastUpdatedRoute);

app.listen(port, () => {
  console.log(
    `Server is running on ${
      process.env.NODE_ENV === "production"
        ? "ttv.danishmohammed.ca"
        : `http://localhost:${port}`
    }`
  );
});
