import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import mongoose from "mongoose";
import userroutes from "./routes/auth.js"
import questionroute from "./routes/question.js"
import answerroutes from "./routes/answer.js"
import timeGate from "./middleware/timeGate.js";

const app = express();
dotenv.config();
app.use(express.json({ limit: "30mb", extended: true }));
app.use(express.urlencoded({ limit: "30mb", extended: true }));
app.use(cors());
app.use(timeGate);

app.get("/", (req, res) => {
  res.send("Stackoverflow clone is running perfect");
});
app.get("/api/db-check", (req, res) => {
  res.json({
    host: mongoose.connection.host,
    name: mongoose.connection.name,
    readyState: mongoose.connection.readyState
  });
});
app.use('/user', userroutes)
app.use('/question', questionroute)
app.use('/answer', answerroutes)
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
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
  });
