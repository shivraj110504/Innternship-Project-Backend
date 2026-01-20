import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";
import userroutes from "./routes/auth.js";
import questionroute from "./routes/question.js";
import answerroutes from "./routes/answer.js";
import postroutes from "./routes/post.js";
import subscriptionRoutes from "./routes/subscription.js";
import timeGate from "./middleware/timeGate.js";

const app = express();
dotenv.config();

// IMPORTANT: Webhook route BEFORE express.json() middleware
app.use("/subscription/webhook", subscriptionRoutes);

// Regular middleware
app.use(express.json({ limit: "30mb", extended: true }));
app.use(express.urlencoded({ limit: "30mb", extended: true }));
app.use(cors({
  origin: ["http://localhost:3000", "https://innternship-project-stackoverflow.vercel.app"],
  credentials: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "PUT", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.use(timeGate);

app.get("/", (req, res) => {
  res.send("Stackoverflow clone with subscriptions is running");
});

app.get("/api/db-check", (req, res) => {
  res.json({
    host: mongoose.connection.host,
    name: mongoose.connection.name,
    readyState: mongoose.connection.readyState
  });
});

// Routes
app.use('/user', userroutes);
app.use('/question', questionroute);
app.use('/answer', answerroutes);
app.use('/post', postroutes);
app.use('/subscription', subscriptionRoutes);

const PORT = process.env.PORT || 5000;
const databaseurl = process.env.MONGODB_URL || "mongodb://localhost:27017/stackoverflow";

mongoose
  .connect(databaseurl, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => {
    console.log("✅ Connected to MongoDB");
    console.log("Host:", mongoose.connection.host);
    console.log("Database:", mongoose.connection.name);
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`💳 Stripe integration active`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
  });