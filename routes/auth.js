import express from "express";
import auth from "../middleware/auth.js";
import {
  getallusers,
  Login,
  Signup,
  updateprofile,
  verifyOTP,
  getLoginHistory,
  verifyPhoneEmail,
  forgotPassword
} from "../controller/auth.js";

const router = express.Router();
router.post("/signup", Signup);
router.post("/login", Login);
router.post("/verify-otp", verifyOTP);
router.post("/verify-phone-email", verifyPhoneEmail);
router.post("/forgot-password", forgotPassword);
router.get("/login-history/:userId", auth, getLoginHistory);
router.get("/getalluser", getallusers);
router.patch("/update/:id", auth, updateprofile);
export default router;
