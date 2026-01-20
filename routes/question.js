import express from "express";
import { askquestion, getallquestions, deletequestion, votequestion } from "../controller/question.js";
import auth from "../middleware/auth.js";
import { checkSubscriptionLimit } from "../middleware/checkSubscription.js";

const router = express.Router();

// Ask question route with subscription check
router.post("/ask", auth, checkSubscriptionLimit, askquestion);

// FIXED: Changed from "/get" to "/getallquestion" to match frontend
router.get("/getallquestion", getallquestions);
router.delete("/delete/:id", auth, deletequestion);
router.patch("/vote/:id", auth, votequestion);

export default router;