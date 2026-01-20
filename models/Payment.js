import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true 
  },
  stripePaymentIntentId: { type: String },
  stripeInvoiceId: { type: String },
  amount: { type: Number, required: true },
  currency: { type: String, default: "INR" },
  plan: { 
    type: String, 
    enum: ["BRONZE", "SILVER", "GOLD"], 
    required: true 
  },
  status: { 
    type: String, 
    enum: ["pending", "succeeded", "failed", "refunded"], 
    default: "pending" 
  },
  invoiceUrl: { type: String },
  paymentDate: { type: Date, default: Date.now },
  metadata: { type: Object }
});

// Index for queries
paymentSchema.index({ userId: 1, paymentDate: -1 });

const Payment = mongoose.model("Payment", paymentSchema);
export default Payment;