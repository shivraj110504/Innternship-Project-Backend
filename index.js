// Training/stackoverflow/server/index.js

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
import webhookRoutes from "./routes/webhook.js";

dotenv.config();

const app = express();

// CORS Configuration - UPDATED
const allowedOrigins = [
  "http://localhost:3000",
  "https://internship-project-frontend-umber.vercel.app",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log("⚠️ Blocked by CORS:", origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
}));

app.use(cookieParser());
app.use(express.json());

// Routes
app.use("/user", userRoutes);
app.use("/question", questionRoutes);
app.use("/answer", answerRoutes);
app.use("/post", postRoutes);
app.use("/subscription", subscriptionRoutes);
app.use("/webhook", webhookRoutes);

// Health check endpoint
app.get("/", (req, res) => {
  res.json({ message: "Server is running", timestamp: new Date() });
});

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log("✅ MongoDB connected"))
.catch((err) => console.error("❌ MongoDB connection error:", err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`✅ Allowed origins:`, allowedOrigins);
});