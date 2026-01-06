import mongoose from "mongoose";

const loginHistorySchema = mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "user", required: true },
    ip: { type: String, required: true },
    browser: { type: String, required: true },
    os: { type: String, required: true },
    deviceType: { type: String, required: true },
    userAgent: { type: String, required: true },
    loginTime: { type: Date, default: Date.now },
    authMethod: { type: String, enum: ["OTP", "PASSWORD", "NONE"], default: "PASSWORD" },
    status: { type: String, enum: ["SUCCESS", "BLOCKED", "PENDING_OTP"], default: "SUCCESS" },
});

export default mongoose.model("LoginHistory", loginHistorySchema);
