// Training/stackoverflow/server/config/stripe.js

import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  console.error("❌ STRIPE_SECRET_KEY is not set in environment variables");
}

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
    stripePriceId: null, // No Stripe price for free plan
  },
  BRONZE: {
    name: "Bronze Plan",
    price: 10000, // ₹100.00 in paise
    currency: "INR",
    dailyQuestionLimit: 5,
    stripePriceId: null, // Will be set after creating in Stripe
  },
  SILVER: {
    name: "Silver Plan",
    price: 30000, // ₹300.00 in paise
    currency: "INR",
    dailyQuestionLimit: 10,
    stripePriceId: null, // Will be set after creating in Stripe
  },
  GOLD: {
    name: "Gold Plan",
    price: 100000, // ₹1000.00 in paise
    currency: "INR",
    dailyQuestionLimit: 999999, // Unlimited
    stripePriceId: null, // Will be set after creating in Stripe
  },
};

// Helper function to get plan details
export const getPlanDetails = (planName) => {
  return SUBSCRIPTION_PLANS[planName] || SUBSCRIPTION_PLANS.FREE;
};