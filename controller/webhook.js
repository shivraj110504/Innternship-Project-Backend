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
    console.error("Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log(`[WEBHOOK] Received event: ${event.type}`);

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
        console.log(`[WEBHOOK] Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("[WEBHOOK] Error processing webhook:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
};

// Handle successful checkout
async function handleCheckoutSessionCompleted(session) {
  const { customer, subscription: stripeSubscriptionId, metadata } = session;
  const { userId, plan } = metadata;

  console.log(`[WEBHOOK] Checkout completed for user ${userId}, plan ${plan}`);

  const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const planDetails = getPlanDetails(plan);

  // Create or update subscription
  await Subscription.findOneAndUpdate(
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

  console.log(`[WEBHOOK] Subscription created/updated for user ${userId}`);
}

// Handle successful invoice payment
async function handleInvoicePaymentSucceeded(invoice) {
  const { customer, subscription: stripeSubscriptionId, amount_paid, hosted_invoice_url } = invoice;

  console.log(`[WEBHOOK] Invoice payment succeeded: ${invoice.id}`);

  // Find subscription
  const subscription = await Subscription.findOne({ stripeSubscriptionId });
  if (!subscription) {
    console.error("[WEBHOOK] Subscription not found for invoice");
    return;
  }

  // Get user
  const user = await User.findById(subscription.userId);
  if (!user) {
    console.error("[WEBHOOK] User not found");
    return;
  }

  // Record payment
  await Payment.create({
    userId: subscription.userId,
    stripeInvoiceId: invoice.id,
    stripePaymentIntentId: invoice.payment_intent,
    amount: amount_paid,
    currency: invoice.currency.toUpperCase(),
    plan: subscription.plan,
    status: "succeeded",
    invoiceUrl: hosted_invoice_url,
    paymentDate: new Date(invoice.created * 1000),
    metadata: {
      subscriptionId: stripeSubscriptionId,
      billingReason: invoice.billing_reason,
    },
  });

  // Send invoice email
  await sendSubscriptionInvoiceEmail({
    email: user.email,
    userName: user.name,
    plan: subscription.plan,
    amount: amount_paid,
    invoiceUrl: hosted_invoice_url,
    subscriptionId: stripeSubscriptionId,
    currentPeriodEnd: subscription.currentPeriodEnd,
  });

  console.log(`[WEBHOOK] Payment recorded and invoice sent to ${user.email}`);
}

// Handle failed invoice payment
async function handleInvoicePaymentFailed(invoice) {
  const { subscription: stripeSubscriptionId } = invoice;

  console.log(`[WEBHOOK] Invoice payment failed: ${invoice.id}`);

  const subscription = await Subscription.findOne({ stripeSubscriptionId });
  if (subscription) {
    subscription.status = "past_due";
    await subscription.save();

    // Record failed payment
    await Payment.create({
      userId: subscription.userId,
      stripeInvoiceId: invoice.id,
      amount: invoice.amount_due,
      currency: invoice.currency.toUpperCase(),
      plan: subscription.plan,
      status: "failed",
      paymentDate: new Date(invoice.created * 1000),
    });
  }
}

// Handle subscription updates
async function handleSubscriptionUpdated(stripeSubscription) {
  console.log(`[WEBHOOK] Subscription updated: ${stripeSubscription.id}`);

  await Subscription.findOneAndUpdate(
    { stripeSubscriptionId: stripeSubscription.id },
    {
      status: stripeSubscription.status,
      currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
      currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      updatedAt: new Date(),
    }
  );
}

// Handle subscription deletion
async function handleSubscriptionDeleted(stripeSubscription) {
  console.log(`[WEBHOOK] Subscription deleted: ${stripeSubscription.id}`);

  const subscription = await Subscription.findOne({
    stripeSubscriptionId: stripeSubscription.id,
  });

  if (subscription) {
    // Downgrade to FREE plan
    subscription.plan = "FREE";
    subscription.status = "canceled";
    subscription.dailyQuestionLimit = 1;
    subscription.questionsAskedToday = 0;
    subscription.updatedAt = new Date();
    await subscription.save();
  }
}