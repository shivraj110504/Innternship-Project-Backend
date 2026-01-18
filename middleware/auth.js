import jwt from "jsonwebtoken";
const auth = (req, res, next) => {
  try {
    // Check if authorization header exists
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthenticated - No token provided" });
    }

    // Extract token from "Bearer <token>"
    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "Unauthenticated - Invalid token format" });
    }

    // Verify token
    const decodedata = jwt.verify(token, process.env.JWT_SECRET);
    if (!decodedata || !decodedata.id) {
      return res.status(401).json({ message: "Unauthenticated - Invalid token" });
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