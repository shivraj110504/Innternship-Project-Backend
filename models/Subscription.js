import mongoose from "mongoose";

const subscriptionSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  stripeCustomerId: { type: String, required: true },
  stripeSubscriptionId: { type: String, required: true },
  stripePriceId: { type: String, required: true },
  plan: { 
    type: String, 
    enum: ["FREE", "BRONZE", "SILVER", "GOLD"], 
    default: "FREE" 
  },
  status: { 
    type: String, 
    enum: ["active", "canceled", "past_due", "incomplete", "trialing"], 
    default: "active" 
  },
  currentPeriodStart: { type: Date },
  currentPeriodEnd: { type: Date },
  cancelAtPeriodEnd: { type: Boolean, default: false },
  dailyQuestionLimit: { type: Number, default: 1 },
  questionsAskedToday: { type: Number, default: 0 },
  lastQuestionDate: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Index for efficient queries
subscriptionSchema.index({ userId: 1 });
subscriptionSchema.index({ stripeSubscriptionId: 1 });

const Subscription = mongoose.model("Subscription", subscriptionSchema);
export default Subscription;