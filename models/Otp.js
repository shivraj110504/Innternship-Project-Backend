// models/Otp.js

import mongoose from "mongoose";

const otpSchema = mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    otp: { type: String, required: true },
    email: { type: String },
    phone: { type: String },
    createdAt: { type: Date, default: Date.now, expires: 300 }, // Expires in 5 minutes
});

export default mongoose.model("Otp", otpSchema);
