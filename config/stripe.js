import Stripe from "stripe";
import dotenv from "dotenv";

dotenv.config();

// Initialize Stripe
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2023-10-16",
});

// Subscription Plans Configuration
export const SUBSCRIPTION_PLANS = {
  FREE: {
    name: "Free Plan",
    price: 0,
    currency: "INR",
    dailyQuestionLimit: 1,
    stripePriceId: null,
  },
  BRONZE: {
    name: "Bronze Plan",
    price: 10000, // ₹100 in paise (Stripe uses smallest currency unit)
    currency: "INR",
    dailyQuestionLimit: 5,
    stripePriceId: null,
  },
  SILVER: {
    name: "Silver Plan",
    price: 30000, // ₹300 in paise
    currency: "INR",
    dailyQuestionLimit: 10,
    stripePriceId: null,
  },
  GOLD: {
    name: "Gold Plan",
    price: 100000, // ₹1000 in paise
    currency: "INR",
    dailyQuestionLimit: 999999, // Unlimited
    stripePriceId: null,
  },
};

// Helper function to get plan details
export const getPlanDetails = (planName) => {
  const plan = SUBSCRIPTION_PLANS[planName];
  if (!plan) {
    throw new Error(`Invalid plan: ${planName}`);
  }
  return plan;
};

// Helper function to format price
export const formatPrice = (amount, currency = "INR") => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency,
  }).format(amount / 100);
};

// Validate Stripe configuration
export const validateStripeConfig = () => {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error("STRIPE_SECRET_KEY is not set in environment variables");
  }
  
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.warn("⚠️ STRIPE_WEBHOOK_SECRET is not set - webhooks will not work");
  }
  
  console.log("✅ Stripe configuration validated");
};

// Call validation on import
validateStripeConfig();