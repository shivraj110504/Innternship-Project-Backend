// Training/stackoverflow/server/models/Payment.js

import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
  userId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "User", 
    required: true,
    index: true
  },
  stripePaymentIntentId: { 
    type: String,
    sparse: true // Allow null/undefined
  },
  stripeInvoiceId: { 
    type: String,
    required: true,
    unique: true
  },
  amount: { 
    type: Number, 
    required: true 
  },
  currency: { 
    type: String, 
    default: "INR",
    uppercase: true
  },
  status: { 
    type: String, 
    enum: ["succeeded", "failed", "pending", "refunded"], 
    required: true 
  },
  plan: { 
    type: String, 
    enum: ["BRONZE", "SILVER", "GOLD"],
    required: true
  },
  paymentDate: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  invoiceUrl: { 
    type: String 
  },
  metadata: {
    type: Object,
    default: {}
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
});

// Compound index for efficient queries
paymentSchema.index({ userId: 1, paymentDate: -1 });
paymentSchema.index({ stripeInvoiceId: 1 });
paymentSchema.index({ status: 1 });

// Update timestamp on save
paymentSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Virtual for formatted amount
paymentSchema.virtual('formattedAmount').get(function() {
  return `${this.currency} ${(this.amount / 100).toFixed(2)}`;
});

// Enable virtuals in JSON
paymentSchema.set('toJSON', { virtuals: true });
paymentSchema.set('toObject', { virtuals: true });

const Payment = mongoose.model("Payment", paymentSchema);
export default Payment;