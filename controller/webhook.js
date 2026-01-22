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
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    console.log("✅ Webhook verified:", event.type);
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    // Handle different event types
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
        console.log(`⚠️ Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error("❌ Webhook handler error:", error);
    res.status(500).json({ error: "Webhook handler failed" });
  }
};

// Handle checkout session completed
async function handleCheckoutSessionCompleted(session) {
  console.log("🎉 Checkout session completed:", session.id);

  const { customer, subscription: stripeSubId, metadata } = session;
  const { userId, plan } = metadata;

  if (!userId || !plan) {
    console.error("❌ Missing userId or plan in metadata");
    return;
  }

  try {
    // Get subscription details from Stripe
    const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubId);
    const planDetails = getPlanDetails(plan);

    // Update or create subscription in database
    let subscription = await Subscription.findOne({ userId });

    if (subscription) {
      // Update existing subscription
      subscription.stripeCustomerId = customer;
      subscription.stripeSubscriptionId = stripeSubId;
      subscription.stripePriceId = stripeSubscription.items.data[0].price.id;
      subscription.plan = plan;
      subscription.status = "active";
      subscription.currentPeriodStart = new Date(stripeSubscription.current_period_start * 1000);
      subscription.currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);
      subscription.cancelAtPeriodEnd = false;
      subscription.dailyQuestionLimit = planDetails.dailyQuestionLimit;
      subscription.questionsAskedToday = 0;
    } else {
      // Create new subscription
      subscription = new Subscription({
        userId,
        stripeCustomerId: customer,
        stripeSubscriptionId: stripeSubId,
        stripePriceId: stripeSubscription.items.data[0].price.id,
        plan,
        status: "active",
        currentPeriodStart: new Date(stripeSubscription.current_period_start * 1000),
        currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
        dailyQuestionLimit: planDetails.dailyQuestionLimit,
        questionsAskedToday: 0,
      });
    }

    await subscription.save();
    console.log("✅ Subscription saved:", subscription._id);

    // Get user details for email
    const user = await User.findById(userId);
    if (user) {
      console.log("📧 Sending confirmation email to:", user.email);
    }
  } catch (error) {
    console.error("❌ Error handling checkout session:", error);
  }
}

// Handle successful invoice payment
async function handleInvoicePaymentSucceeded(invoice) {
  console.log("💰 Invoice payment succeeded:", invoice.id);

  const { customer, subscription: stripeSubId, amount_paid, hosted_invoice_url } = invoice;

  try {
    // Find subscription by Stripe subscription ID
    const subscription = await Subscription.findOne({ stripeSubscriptionId: stripeSubId });

    if (!subscription) {
      console.error("❌ Subscription not found for invoice:", invoice.id);
      return;
    }

    // Check if payment already recorded
    const existingPayment = await Payment.findOne({ stripeInvoiceId: invoice.id });
    if (existingPayment) {
      console.log("⚠️ Payment already recorded:", invoice.id);
      return;
    }

    // Create payment record
    const payment = await Payment.create({
      userId: subscription.userId,
      stripePaymentIntentId: invoice.payment_intent,
      stripeInvoiceId: invoice.id,
      amount: amount_paid,
      currency: invoice.currency.toUpperCase(),
      status: "succeeded",
      plan: subscription.plan,
      paymentDate: new Date(invoice.created * 1000),
      invoiceUrl: hosted_invoice_url,
      metadata: {
        subscriptionId: subscription._id,
        stripeSubscriptionId: stripeSubId,
      },
    });

    console.log("✅ Payment recorded:", payment._id);

    // Get user and send invoice email
    const user = await User.findById(subscription.userId);
    if (user && user.email) {
      try {
        await sendSubscriptionInvoiceEmail(
          user.email,
          user.name,
          subscription.plan,
          amount_paid / 100,
          invoice.currency.toUpperCase(),
          hosted_invoice_url
        );
        console.log("📧 Invoice email sent to:", user.email);
      } catch (emailError) {
        console.error("❌ Failed to send invoice email:", emailError);
      }
    }
  } catch (error) {
    console.error("❌ Error handling invoice payment:", error);
  }
}

// Handle failed invoice payment
async function handleInvoicePaymentFailed(invoice) {
  console.log("❌ Invoice payment failed:", invoice.id);

  const { subscription: stripeSubId } = invoice;

  try {
    const subscription = await Subscription.findOne({ stripeSubscriptionId: stripeSubId });

    if (subscription) {
      subscription.status = "past_due";
      await subscription.save();
      console.log("⚠️ Subscription marked as past_due");
    }

    // Record failed payment
    await Payment.create({
      userId: subscription.userId,
      stripePaymentIntentId: invoice.payment_intent,
      stripeInvoiceId: invoice.id,
      amount: invoice.amount_due,
      currency: invoice.currency.toUpperCase(),
      status: "failed",
      plan: subscription.plan,
      paymentDate: new Date(),
    });
  } catch (error) {
    console.error("❌ Error handling failed payment:", error);
  }
}

// Handle subscription updates
async function handleSubscriptionUpdated(stripeSubscription) {
  console.log("🔄 Subscription updated:", stripeSubscription.id);

  try {
    const subscription = await Subscription.findOne({
      stripeSubscriptionId: stripeSubscription.id,
    });

    if (subscription) {
      subscription.status = stripeSubscription.status;
      subscription.currentPeriodStart = new Date(stripeSubscription.current_period_start * 1000);
      subscription.currentPeriodEnd = new Date(stripeSubscription.current_period_end * 1000);
      subscription.cancelAtPeriodEnd = stripeSubscription.cancel_at_period_end;

      await subscription.save();
      console.log("✅ Subscription updated in database");
    }
  } catch (error) {
    console.error("❌ Error updating subscription:", error);
  }
}

// Handle subscription deletion
async function handleSubscriptionDeleted(stripeSubscription) {
  console.log("🗑️ Subscription deleted:", stripeSubscription.id);

  try {
    const subscription = await Subscription.findOne({
      stripeSubscriptionId: stripeSubscription.id,
    });

    if (subscription) {
      subscription.status = "canceled";
      subscription.plan = "FREE";
      subscription.dailyQuestionLimit = 1;
      subscription.questionsAskedToday = 0;

      await subscription.save();
      console.log("✅ Subscription downgraded to FREE");
    }
  } catch (error) {
    console.error("❌ Error handling subscription deletion:", error);
  }
}