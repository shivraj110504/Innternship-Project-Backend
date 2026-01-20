// middleware/auth,js

import jwt from "jsonwebtoken";
const auth = (req, res, next) => {
  try {
    // Check for token in Cookie header first
    let token = null;
    if (req.headers.cookie) {
      const cookies = req.headers.cookie.split(';').reduce((acc, cookie) => {
        const [key, value] = cookie.trim().split('=');
        acc[key] = value;
        return acc;
      }, {});
      token = cookies['token'];
    }

    // Fallback to Authorization header if no cookie token
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
      }
    }

    if (!token) {
      return res.status(401).json({ message: "Please login to continue" });
    }

    // Verify token
    const decodedata = jwt.verify(token, process.env.JWT_SECRET);
    if (!decodedata || !decodedata.id) {
      return res.status(401).json({ message: "Please login to continue" });
    }

    req.userid = decodedata.id;
    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Authentication failed. Please login again." });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Session expired. Please login again." });
    }
    return res.status(401).json({ message: "Authentication failed. Please login again." });
  }
};
export default auth