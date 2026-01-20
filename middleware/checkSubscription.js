import Subscription from "../models/Subscription.js";

export const checkSubscriptionLimit = async (req, res, next) => {
  try {
    const userId = req.userid; // From auth middleware

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Get or create subscription
    let subscription = await Subscription.findOne({ userId });

    if (!subscription) {
      // Create FREE subscription for new users
      subscription = await Subscription.create({
        userId,
        stripeCustomerId: "free_user",
        stripeSubscriptionId: "free_sub",
        stripePriceId: "free_price",
        plan: "FREE",
        status: "active",
        dailyQuestionLimit: 1,
        questionsAskedToday: 0,
        currentPeriodEnd: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });
    }

    // Check if subscription is active
    if (subscription.status !== "active") {
      return res.status(403).json({
        message: "Your subscription is not active. Please renew to continue asking questions.",
        plan: subscription.plan,
        status: subscription.status,
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

    // Check daily limit
    const remaining = subscription.dailyQuestionLimit - subscription.questionsAskedToday;

    if (remaining <= 0) {
      return res.status(403).json({
        message: `Daily question limit reached. You can ask ${subscription.dailyQuestionLimit} question(s) per day on the ${subscription.plan} plan.`,
        plan: subscription.plan,
        limit: subscription.dailyQuestionLimit,
        questionsAskedToday: subscription.questionsAskedToday,
        upgradeRequired: subscription.plan !== "GOLD",
      });
    }

    // Attach subscription to request for use in controller
    req.subscription = subscription;
    next();
  } catch (error) {
    console.error("Subscription Check Error:", error);
    res.status(500).json({ message: "Failed to check subscription status" });
  }
};