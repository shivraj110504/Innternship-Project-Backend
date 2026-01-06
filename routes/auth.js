import express from "express";
import {
  getallusers,
  Login,
  Signup,
  updateprofile,
  verifyOTP,
  getLoginHistory,
} from "../controller/auth.js";

const router = express.Router();
import auth from "../middleware/auth.js";
router.post("/signup", Signup);
router.post("/login", Login);
router.post("/verify-otp", verifyOTP);
router.get("/login-history/:userId", auth, getLoginHistory);
router.get("/getalluser", getallusers);
router.patch("/update/:id", auth, updateprofile);
export default router;
