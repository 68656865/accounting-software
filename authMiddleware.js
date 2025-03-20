const jwt = require("jsonwebtoken");

// Middleware for role-based access control
const authMiddleware = (allowedRoles) => {
  return (req, res, next) => {
    const authHeader = req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Access Denied: No token provided" });
    }

    const token = authHeader.split(" ")[1];

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;

      // Check if user has the required role
      if (!allowedRoles.includes(req.user.role)) {
        return res.status(403).json({ message: "Forbidden: You do not have access" });
      }

      next();
    } catch (error) {
      console.error("JWT Verification Error:", error);
      res.status(401).json({ message: "Invalid Token" });
    }
  };
};

// Middleware for general JWT authentication
const jwtAuth = (req, res, next) => {
  const token = req.headers["authorization"]?.split(" ")[1];

  if (!token) return res.status(401).json({ message: "Access Denied" });

  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET);
    req.user = verified; // Attach user info
    next();
  } catch (err) {
    console.error("JWT Verification Error:", err);
    res.status(403).json({ message: "Invalid Token" });
  }
};

// ✅ Export both middlewares
module.exports = { authMiddleware, jwtAuth };





