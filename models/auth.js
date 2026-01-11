import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },

  phone: { type: String, unique: true, sparse: true },
  phoneVerified: { type: Boolean, default: false },

  forgotPasswordAt: { type: Date },
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],

  about: String,
  tags: [String],
  joinDate: { type: Date, default: Date.now },
});

// Export the model as default
const User = mongoose.model("User", userSchema);
export default User;
