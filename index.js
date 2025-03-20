require("dotenv").config();
const express = require("express");
const session = require("express-session");
const MongoStore = require("connect-mongo");
const connection = require("./connection"); // MongoDB connection
const register = require("./register"); // Auth rout
const accountRoutes = require("./accountRoutes"); // Financial routes

const app = express();
app.use(express.json());

// app.use("/api", accountRoutes);

// ✅ Session Configuration
app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecretkey",
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGO_URI,
      collectionName: "sessions",
    }),
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 3600000,
    },
  })
);

// ✅ Use Routes
app.use("/registration", register);
app.use("/accounts", accountRoutes); // ⬅️ Use account routes
 

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));





