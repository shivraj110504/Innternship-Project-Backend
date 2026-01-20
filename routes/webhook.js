// Training/stackoverflow/server/routes/webhook.js

import express from "express";
import { handleStripeWebhook } from "../controller/webhook.js";

const router = express.Router();

router.post("/stripe", express.raw({ type: 'application/json' }), handleStripeWebhook);

export default router; // ADD THIS LINE IF MISSING