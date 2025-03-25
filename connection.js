require("dotenv").config();
const mongoose = require("mongoose");

console.log("⏳ Connecting to MongoDB...");

mongoose
  .connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/accounting-software", {

  })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ Could not connect to MongoDB", err));







