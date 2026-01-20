import { stripe, SUBSCRIPTION_PLANS, getPlanDetails } from "../config/stripe.js";
import Subscription from "../models/Subscription.js";
import Payment from "../models/Payment.js";
import User from "../models/auth.js";
import { sendSubscriptionInvoiceEmail } from "../utils/emailService.js";
import moment from "moment-timezone";

// Create Checkout Session for Subscription
export const createCheckoutSession = async (req, res) => {
  try {
    const userId = req.userid; // From auth middleware
    const { plan } = req.body;

    // Validate plan
    if (!["BRONZE", "SILVER", "GOLD"].includes(plan)) {
      return res.status(400).json({ message: "Invalid plan selected" });
    }

    // Time-based payment restriction (10-11 AM IST)
    const nowIST = moment().tz("Asia/Kolkata");
    const hour = nowIST.hour();
    
    if (hour < 10 || hour >= 11) {
      return res.status(403).json({
        message: "Payments are only allowed between 10:00 AM and 11:00 AM IST. Please try again during this time window.",
        allowedTime: "10:00 AM - 11:00 AM IST"
      });
    }

    // Get user details
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if user already has an active subscription
    const existingSubscription = await Subscription.findOne({
      userId,
      status: "active",
    });

    if (existingSubscription && existingSubscription.plan !== "FREE") {
      return res.status(400).json({
        message: "You already have an active subscription. Please cancel it first.",
      });
    }

    const planDetails = getPlanDetails(plan);

    // Get or create Stripe customer
    let customerId;
    const existingSub = await Subscription.findOne({ userId });
    
    if (existingSub && existingSub.stripeCustomerId) {
      customerId = existingSub.stripeCustomerId;
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.name,
        metadata: {
          userId: userId.toString(),
        },
      });
      customerId = customer.id;
    }

    // Create or get Stripe Price
    let priceId = planDetails.stripePriceId;
    
    if (!priceId) {
      const product = await stripe.products.create({
        name: planDetails.name,
        description: `${planDetails.dailyQuestionLimit === 999999 ? 'Unlimited' : planDetails.dailyQuestionLimit} questions per day`,
      });

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: planDetails.price,
        currency: planDetails.currency.toLowerCase(),
        recurring: { interval: "month" },
      });

      priceId = price.id;
      SUBSCRIPTION_PLANS[plan].stripePriceId = priceId;
    }

    // Create Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${process.env.FRONTEND_URL}/subscription/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/subscription/cancel`,
      metadata: {
        userId: userId.toString(),
        plan: plan,
      },
    });

    res.status(200).json({
      sessionId: session.id,
      url: session.url,
    });
  } catch (error) {
    console.error("Checkout Session Error:", error);
    res.status(500).json({ message: error.message || "Failed to create checkout session" });
  }
};

// Get user's current subscription
export const getSubscription = async (req, res) => {
  try {
    const userId = req.userid;

    let subscription = await Subscription.findOne({ userId });

    // If no subscription exists, create a FREE one
    if (!subscription) {
      subscription = await Subscription.create({
        userId,
        stripeCustomerId: "free_user",
        stripeSubscriptionId: "free_sub",
        stripePriceId: "free_price",
        plan: "FREE",
        status: "active",
        dailyQuestionLimit: 1,
        questionsAskedToday: 0,
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
      });
    }

    res.status(200).json(subscription);
  } catch (error) {
    console.error("Get Subscription Error:", error);
    res.status(500).json({ message: "Failed to fetch subscription" });
  }
};

// Cancel subscription
export const cancelSubscription = async (req, res) => {
  try {
    const userId = req.userid;

    const subscription = await Subscription.findOne({ userId, status: "active" });

    if (!subscription || subscription.plan === "FREE") {
      return res.status(400).json({ message: "No active subscription to cancel" });
    }

    // Cancel at period end in Stripe
    await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    subscription.cancelAtPeriodEnd = true;
    await subscription.save();

    res.status(200).json({
      message: "Subscription will be cancelled at the end of billing period",
      subscription,
    });
  } catch (error) {
    console.error("Cancel Subscription Error:", error);
    res.status(500).json({ message: "Failed to cancel subscription" });
  }
};

// Check if user can ask question today
export const checkQuestionLimit = async (req, res) => {
  try {
    const userId = req.userid;

    const subscription = await Subscription.findOne({ userId });

    if (!subscription) {
      return res.status(200).json({
        canAsk: true,
        remaining: 1,
        limit: 1,
        plan: "FREE",
      });
    }

    // Reset daily count if it's a new day
    const today = new Date().toDateString();
    const lastQuestionDate = subscription.lastQuestionDate
      ? new Date(subscription.lastQuestionDate).toDateString()
      : null;

    if (lastQuestionDate !== today) {
      subscription.questionsAskedToday = 0;
      await subscription.save();
    }

    const remaining = subscription.dailyQuestionLimit - subscription.questionsAskedToday;
    const canAsk = remaining > 0;

    res.status(200).json({
      canAsk,
      remaining: Math.max(0, remaining),
      limit: subscription.dailyQuestionLimit,
      plan: subscription.plan,
      questionsAskedToday: subscription.questionsAskedToday,
    });
  } catch (error) {
    console.error("Check Question Limit Error:", error);
    res.status(500).json({ message: "Failed to check question limit" });
  }
};

// Increment question count
export const incrementQuestionCount = async (userId) => {
  try {
    const subscription = await Subscription.findOne({ userId });

    if (!subscription) {
      // Create FREE subscription if not exists
      await Subscription.create({
        userId,
        stripeCustomerId: "free_user",
        stripeSubscriptionId: "free_sub",
        stripePriceId: "free_price",
        plan: "FREE",
        status: "active",
        dailyQuestionLimit: 1,
        questionsAskedToday: 1,
        lastQuestionDate: new Date(),
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });
      return;
    }

    const today = new Date().toDateString();
    const lastQuestionDate = subscription.lastQuestionDate
      ? new Date(subscription.lastQuestionDate).toDateString()
      : null;

    if (lastQuestionDate !== today) {
      subscription.questionsAskedToday = 1;
    } else {
      subscription.questionsAskedToday += 1;
    }

    subscription.lastQuestionDate = new Date();
    await subscription.save();
  } catch (error) {
    console.error("Increment Question Count Error:", error);
  }
};

// Get payment history
export const getPaymentHistory = async (req, res) => {
  try {
    const userId = req.userid;

    const payments = await Payment.find({ userId })
      .sort({ paymentDate: -1 })
      .limit(20);

    res.status(200).json(payments);
  } catch (error) {
    console.error("Payment History Error:", error);
    res.status(500).json({ message: "Failed to fetch payment history" });
  }
};