// Training/stackoverflow/server/controller/webhook.js - PROPERLY FIXED

import { stripe, getPlanDetails } from "../config/stripe.js";
import Subscription from "../models/Subscription.js";
import Payment from "../models/Payment.js";
import User from "../models/auth.js";
import { sendSubscriptionInvoiceEmail } from "../utils/emailService.js";

export const handleStripeWebhook = async (req, res) => {
  const sig = req.headers["stripe-signature"];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`📦 [WEBHOOK] Received event: ${event.type}`);

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object);
        break;

      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event.data.object);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        break;

      default:
        console.log(`⚠️ [WEBHOOK] Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("❌ [WEBHOOK] Error processing webhook:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
};

// Handle successful checkout
async function handleCheckoutSessionCompleted(session) {
  try {
    const { customer, subscription: stripeSubscriptionId, metadata } = session;
    const { userId, plan } = metadata;

    console.log(`✅ [WEBHOOK] Checkout completed for user ${userId}, plan ${plan}`);

    if (!stripeSubscriptionId) {
      console.error("❌ [WEBHOOK] No subscription ID in checkout session");
      return;
    }

    // Retrieve full subscription details from Stripe
    const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
    const planDetails = getPlanDetails(plan);

    // Create or update subscription
    const updatedSubscription = await Subscription.findOneAndUpdate(
      { userId },
      {
        stripeCustomerId: customer,
        stripeSubscriptionId: stripeSubscriptionId,
        stripePriceId: stripeSubscription.items.data[0].price.id,
        plan: plan,
        status: stripeSubscription.status,
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        dailyQuestionLimit: planDetails.dailyQuestionLimit,
        questionsAskedToday: 0,
        cancelAtPeriodEnd: false,
        updatedAt: new Date(),
      },
      { upsert: true, new: true }
    );

    console.log(`✅ [WEBHOOK] Subscription created/updated for user ${userId}`, {
      subscriptionId: updatedSubscription._id,
      plan: updatedSubscription.plan,
      dailyLimit: updatedSubscription.dailyQuestionLimit
    });
  } catch (error) {
    console.error("❌ [WEBHOOK] Error in handleCheckoutSessionCompleted:", error);
    throw error;
  }
}

// Handle successful invoice payment
async function handleInvoicePaymentSucceeded(invoice) {
  try {
    const { 
      customer, 
      subscription: stripeSubscriptionId, 
      amount_paid, 
      hosted_invoice_url,
      payment_intent,
      id: invoiceId,
      created,
      currency,
      billing_reason
    } = invoice;

    console.log(`✅ [WEBHOOK] Invoice payment succeeded: ${invoiceId}`);

    if (!stripeSubscriptionId) {
      console.log("⚠️ [WEBHOOK] Invoice has no subscription (might be one-time payment)");
      return;
    }

    // Find subscription
    const subscription = await Subscription.findOne({ stripeSubscriptionId });
    if (!subscription) {
      console.error("❌ [WEBHOOK] Subscription not found for invoice:", invoiceId);
      return;
    }

    // Get user
    const user = await User.findById(subscription.userId);
    if (!user) {
      console.error("❌ [WEBHOOK] User not found for subscription:", subscription._id);
      return;
    }

    // Record payment
    const payment = await Payment.create({
      userId: subscription.userId,
      stripeInvoiceId: invoiceId,
      stripePaymentIntentId: payment_intent,
      amount: amount_paid,
      currency: currency.toUpperCase(),
      plan: subscription.plan,
      status: "succeeded",
      invoiceUrl: hosted_invoice_url,
      paymentDate: new Date(created * 1000),
    });

    console.log(`✅ [WEBHOOK] Payment recorded:`, {
      paymentId: payment._id,
      amount: amount_paid / 100,
      currency: currency.toUpperCase()
    });

    // Send invoice email
    try {
      await sendSubscriptionInvoiceEmail({
        email: user.email,
        userName: user.name,
        plan: subscription.plan,
        amount: (amount_paid / 100).toFixed(2), // Convert from cents
        currency: currency.toUpperCase(),
        invoiceUrl: hosted_invoice_url,
        subscriptionId: stripeSubscriptionId,
        currentPeriodEnd: subscription.currentPeriodEnd,
        billingReason: billing_reason,
      });
      console.log(`✅ [WEBHOOK] Invoice email sent to ${user.email}`);
    } catch (emailError) {
      console.error("❌ [WEBHOOK] Failed to send invoice email:", emailError);
      // Don't throw - payment is still successful
    }
  } catch (error) {
    console.error("❌ [WEBHOOK] Error in handleInvoicePaymentSucceeded:", error);
    throw error;
  }
}

// Handle failed invoice payment
async function handleInvoicePaymentFailed(invoice) {
  try {
    const { 
      subscription: stripeSubscriptionId,
      id: invoiceId,
      amount_due,
      currency,
      created
    } = invoice;

    console.log(`❌ [WEBHOOK] Invoice payment failed: ${invoiceId}`);

    if (!stripeSubscriptionId) {
      console.log("⚠️ [WEBHOOK] Invoice has no subscription");
      return;
    }

    const subscription = await Subscription.findOne({ stripeSubscriptionId });
    
    if (subscription) {
      // Update subscription status
      subscription.status = "past_due";
      await subscription.save();

      console.log(`⚠️ [WEBHOOK] Subscription marked as past_due:`, subscription._id);

      // Record failed payment
      const payment = await Payment.create({
        userId: subscription.userId,
        stripeInvoiceId: invoiceId,
        amount: amount_due,
        currency: currency.toUpperCase(),
        plan: subscription.plan,
        status: "failed",
        paymentDate: new Date(created * 1000),
      });

      console.log(`✅ [WEBHOOK] Failed payment recorded:`, payment._id);

      // TODO: Send email notification to user about failed payment
      const user = await User.findById(subscription.userId);
      if (user && user.email) {
        console.log(`📧 [WEBHOOK] Should send payment failed email to: ${user.email}`);
        // Implement email notification here
      }
    } else {
      console.error("❌ [WEBHOOK] Subscription not found for failed invoice");
    }
  } catch (error) {
    console.error("❌ [WEBHOOK] Error in handleInvoicePaymentFailed:", error);
    throw error;
  }
}

// Handle subscription updates
async function handleSubscriptionUpdated(stripeSubscription) {
  try {
    const { id, status, current_period_start, current_period_end, cancel_at_period_end } = stripeSubscription;

    console.log(`🔄 [WEBHOOK] Subscription updated: ${id}`, {
      status,
      cancelAtPeriodEnd: cancel_at_period_end
    });

    const updatedSubscription = await Subscription.findOneAndUpdate(
      { stripeSubscriptionId: id },
      {
        status: status,
        currentPeriodStart: new Date(current_period_start * 1000),
        currentPeriodEnd: new Date(current_period_end * 1000),
        cancelAtPeriodEnd: cancel_at_period_end,
        updatedAt: new Date(),
      },
      { new: true }
    );

    if (updatedSubscription) {
      console.log(`✅ [WEBHOOK] Subscription updated in database:`, {
        subscriptionId: updatedSubscription._id,
        userId: updatedSubscription.userId,
        status: updatedSubscription.status
      });
    } else {
      console.error("❌ [WEBHOOK] Subscription not found in database:", id);
    }
  } catch (error) {
    console.error("❌ [WEBHOOK] Error in handleSubscriptionUpdated:", error);
    throw error;
  }
}

// Handle subscription deletion
async function handleSubscriptionDeleted(stripeSubscription) {
  try {
    const { id } = stripeSubscription;

    console.log(`🗑️ [WEBHOOK] Subscription deleted: ${id}`);

    const subscription = await Subscription.findOne({
      stripeSubscriptionId: id,
    });

    if (subscription) {
      const previousPlan = subscription.plan;
      
      // Downgrade to FREE plan
      subscription.plan = "FREE";
      subscription.status = "canceled";
      subscription.dailyQuestionLimit = 1;
      subscription.questionsAskedToday = 0;
      subscription.cancelAtPeriodEnd = false;
      subscription.updatedAt = new Date();
      
      // Clear Stripe IDs since subscription is cancelled
      subscription.stripeSubscriptionId = null;
      subscription.stripePriceId = null;
      // Keep stripeCustomerId for potential future upgrades
      
      await subscription.save();

      console.log(`✅ [WEBHOOK] Subscription downgraded to FREE:`, {
        subscriptionId: subscription._id,
        userId: subscription.userId,
        previousPlan,
        newPlan: subscription.plan
      });

      // TODO: Send email notification to user about subscription cancellation
      const user = await User.findById(subscription.userId);
      if (user && user.email) {
        console.log(`📧 [WEBHOOK] Should send cancellation email to: ${user.email}`);
        // Implement email notification here
      }
    } else {
      console.error("❌ [WEBHOOK] Subscription not found in database:", id);
    }
  } catch (error) {
    console.error("❌ [WEBHOOK] Error in handleSubscriptionDeleted:", error);
    throw error;
  }
}