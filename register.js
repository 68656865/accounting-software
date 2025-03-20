const express = require("express");
const bcrypt = require("bcryptjs");
const { User } = require("./user"); // Ensure User is correctly imported

const router = express.Router();
const jwt = require("jsonwebtoken");
;

// Register Route
router.post("/register", async (req, res) => {
  const { name, email, password, role } = req.body;

  try {
    let existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({ name, email, password: hashedPassword, role });
    await newUser.save();

    req.session.user = { id: newUser._id, name, email, role };
    res.status(201).json({ success: true, message: "User registered successfully", user: req.session.user });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server Error", error });
  }
});

// Login Route
router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    // ✅ Generate Access Token (Short-lived)
    const accessToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" } // Token expires in 1 hour
    );

    // ✅ Generate Refresh Token (Long-lived)
    const refreshToken = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_REFRESH_SECRET,
      { expiresIn: "7d" } // Token expires in 7 days
    );

    res.json({
      success: true,
      message: "Login successful",
      accessToken,
      refreshToken
    });

  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: "Server Error", error });
  }
});


/////////////////REFFRESH TOKEN////////////////////


router.post("/refresh-token", async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(403).json({ message: "Refresh token required" });

  try {
    // Verify the refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    // Generate a new access token
    const newAccessToken = jwt.sign(
      { id: decoded.id, role: decoded.role },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({ success: true, accessToken: newAccessToken });
  } catch (error) {
    res.status(403).json({ message: "Invalid refresh token", error });
  }
});



// Logout Route
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ message: "Logout failed" });
    res.clearCookie("connect.sid");
    res.json({ success: true, message: "Logged out successfully" });
  });
});

module.exports = router;

