import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";

// Import routes
import userRoutes from "./routes/auth.js";
import questionRoutes from "./routes/questions.js";
import answerRoutes from "./routes/answers.js";
import postRoutes from "./routes/posts.js";
import subscriptionRoutes from "./routes/subscription.js";

dotenv.config();

const app = express();

// CORS Configuration - FIXED for cookie support
const allowedOrigins = [
  "http://localhost:3000",
  "https://internship-project-frontend-umber.vercel.app",
  "https://innternship-project-stackoverflow.vercel.app", // Added your other frontend
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log("⚠️ Origin not in whitelist (allowing anyway):", origin);
      callback(null, true); // Allow for now during development
    }
  },
  credentials: true, // CRITICAL: Allow cookies
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  exposedHeaders: ['Set-Cookie'], // ADDED: Expose Set-Cookie header
}));

// Middleware - Order is important!
app.use(cookieParser()); // MUST be before routes
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use("/user", userRoutes);
app.use("/question", questionRoutes);
app.use("/answer", answerRoutes);
app.use("/post", postRoutes);
app.use("/subscription", subscriptionRoutes);

// Health check endpoint
app.get("/", (req, res) => {
  res.json({ 
    message: "StackOverflow Clone Server is running", 
    timestamp: new Date(),
    mongodb: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    features: ["Subscription System", "Stripe Payments", "Question Limits"]
  });
});

// Test endpoint to verify cookies
app.get("/api/test-cookie", (req, res) => {
  const token = req.cookies.token;
  res.json({
    hasCookie: !!token,
    cookieLength: token ? token.length : 0,
    allCookies: req.cookies
  });
});

// MongoDB connection with better error handling
const MONGO_URI = process.env.MONGODB_URL;

if (!MONGO_URI) {
  console.error("❌ CRITICAL: MONGO_URI environment variable is not set!");
  console.error("Please add MONGODB_URL to your environment variables");
  process.exit(1);
}

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log("✅ MongoDB connected successfully");
  console.log("📊 Database:", mongoose.connection.db.databaseName);
})
.catch((err) => {
  console.error("❌ MongoDB connection error:", err.message);
  process.exit(1);
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("❌ Server Error:", err);
  res.status(500).json({ 
    message: "Internal server error",
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`✅ Allowed origins:`, allowedOrigins);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔐 CORS credentials enabled: true`);
  console.log(`💳 Stripe integration ready`);
});