import jwt from "jsonwebtoken";

// Optional auth middleware - allows requests without token
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization || req.headers.Authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      req.userid = null;
      return next();
    }
    
    const token = authHeader.split(" ")[1];
    if (token) {
      try {
        const decodedata = jwt.verify(token, process.env.JWT_SECRET);
        if (decodedata && decodedata.id) {
          req.userid = decodedata.id;
        } else {
          req.userid = null;
        }
      } catch (err) {
        // Invalid token - just set to null and continue
        req.userid = null;
      }
    } else {
      req.userid = null;
    }
    
    next();
  } catch (error) {
    req.userid = null;
    next();
  }
};

// Required auth middleware - requires valid token
const auth = (req, res, next) => {
  try {
    // Check if authorization header exists (handle both cases)
    const authHeader = req.headers.authorization || req.headers.Authorization;
    
    if (!authHeader) {
      console.log("Auth middleware: No authorization header found");
      return res.status(401).json({ message: "Unauthenticated - No token provided" });
    }
    
    if (!authHeader.startsWith("Bearer ")) {
      console.log("Auth middleware: Invalid header format:", authHeader.substring(0, 20));
      return res.status(401).json({ message: "Unauthenticated - Invalid token format" });
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
    console.error("Auth middleware error:", error.name, error.message);
    if (error.name === "JsonWebTokenError") {
      return res.status(401).json({ message: "Unauthenticated - Invalid token" });
    }
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Unauthenticated - Token expired" });
    }
    return res.status(401).json({ message: "Unauthenticated - Authentication failed" });
  }
};

export default auth;
export { optionalAuth };