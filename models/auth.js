import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },

  phone: { type: String, unique: true, sparse: true },
  phoneVerified: { type: Boolean, default: false },

  points: { type: Number, default: 0 },

  forgotPasswordAt: { type: Date },
  goldBadges: { type: Number, default: 0 },
  silverBadges: { type: Number, default: 0 },
  bronzeBadges: { type: Number, default: 0 },

  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  sentFriendRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  receivedFriendRequests: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

  about: String,
  tags: [String],
  joinDate: { type: Date, default: Date.now },
});

// Export the model as default
const User = mongoose.model("User", userSchema);
export default User;
