require("dotenv").config(); // Load environment variables

const express = require("express");
const mongoose = require("mongoose");

const authRoutes = require("./routes/auth"); // Import authentication routes

const app = express();
app.use(express.json()); // Middleware to parse JSON requests

// ✅ Connect to MongoDB
console.log("⏳ Connecting to MongoDB...");
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ Could not connect to MongoDB", err));

// ✅ Routes
app.use("/auth", authRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

module.exports = app; // Export app for other files (if needed)
