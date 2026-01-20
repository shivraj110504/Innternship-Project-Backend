import express from "express";
import {
  createCheckoutSession,
  getSubscription,
  cancelSubscription,
  checkQuestionLimit,
  getPaymentHistory,
} from "../controller/subscription.js";
import { handleStripeWebhook } from "../controller/webhook.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// Webhook route (MUST be before express.json() middleware)
router.post("/webhook", express.raw({ type: "application/json" }), handleStripeWebhook);

// Protected routes (require authentication)
router.post("/create-checkout-session", auth, createCheckoutSession);
router.get("/current", auth, getSubscription);
router.post("/cancel", auth, cancelSubscription);
router.get("/check-limit", auth, checkQuestionLimit);
router.get("/payment-history", auth, getPaymentHistory);

export default router;