import mongoose from "mongoose";
import user from "../models/auth.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { UAParser } from "ua-parser-js";
import moment from "moment-timezone";
import { Resend } from "resend";
import LoginHistory from "../models/LoginHistory.js";
import Otp from "../models/Otp.js";

const sendOtpEmail = async (email, otp) => {
  console.log(`[RESEND] Attempting to send OTP email to: ${email}`);

  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    console.error("[RESEND] CRITICAL: RESEND_API_KEY not set!");
    console.log("[DEBUG] OTP is:", otp);
    return;
  }

  const resend = new Resend(resendApiKey);

  try {
    const response = await resend.emails.send({
      from: "StackOverflow <auth@shivrajtaware.in>",
      to: email,
      subject: "Your Login OTP",
      html: `<strong>Your OTP for login is: ${otp}</strong><br>It will expire in 5 minutes.`,
    });

    if (response.error) {
      console.error("[RESEND] API returned an error:", JSON.stringify(response.error, null, 2));
      console.log("[DEBUG] OTP Code for manual login:", otp);

      if (response.error.name === "validation_error" && response.error.message.includes("to authorized email")) {
        console.warn("[RESEND] TIP: When using a new Resend account, you can ONLY send emails to yourself (your signup email). To send to others, you must verify a domain.");
      }
      return;
    }

    console.log("[RESEND] Success! Message ID:", response.data.id);
  } catch (err) {
    console.error("[RESEND] Unexpected system error:", err);
    console.log("[DEBUG] OTP Code for manual login:", otp);
  }
};

// Helper to record login history
const recordLoginHistory = async (req, userId, authMethod, status) => {
  const userAgent = req.headers["user-agent"] || "";
  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress || "127.0.0.1";

  const parser = new UAParser(userAgent);
  const result = parser.getResult();
  const browserName = result.browser.name?.toUpperCase() || "UNKNOWN";
  const osName = result.os.name || "Unknown OS";
  const deviceType = result.device.type || "desktop";

  try {
    await LoginHistory.create({
      userId,
      ip,
      browser: browserName,
      os: osName,
      deviceType,
      userAgent,
      authMethod,
      status,
    });
  } catch (error) {
    console.error("Failed to record login history:", error);
  }
};

export const Signup = async (req, res) => {
  const { name, email, password } = req.body;
  console.log("Signup attempt for:", email);
  try {
    const exisitinguser = await user.findOne({ email });
    if (exisitinguser) {
      console.log("User already exists:", email);
      return res.status(400).json({ message: "User already exist" });
    }
    console.log("Hashing password...");
    const hashpassword = await bcrypt.hash(password, 12);

    const countBefore = await user.countDocuments();
    console.log("User count before create:", countBefore);

    console.log("Creating user...");
    const newuser = await user.create({
      name,
      email,
      password: hashpassword,
    });

    const countAfter = await user.countDocuments();
    console.log("User count after create:", countAfter);
    console.log("Created user ID:", newuser._id);

    console.log("User created, generating token...");
    const token = jwt.sign(
      { email: newuser.email, id: newuser._id },
      process.env.JWT_SECRET || "default_secret",
      { expiresIn: "1h" }
    );

    // Record signup as first login
    await recordLoginHistory(req, newuser._id, "PASSWORD", "SUCCESS");

    console.log("Signup successful for:", email);
    res.status(200).json({ data: newuser, token });
  } catch (error) {
    console.error("Signup Error Detail:", error);
    res.status(500).json({ message: error.message || "Something went wrong during signup" });
  }
};
export const Login = async (req, res) => {
  const { email, password } = req.body;
  const userAgent = req.headers["user-agent"] || "";
  const parser = new UAParser(userAgent);
  const result = parser.getResult();
  const browserName = result.browser.name?.toUpperCase() || "UNKNOWN";
  const deviceType = result.device.type || "desktop";

  try {
    const exisitinguser = await user.findOne({ email });
    if (!exisitinguser) {
      return res.status(404).json({ message: "User does not exist" });
    }

    const ispasswordcrct = await bcrypt.compare(password, exisitinguser.password);
    if (!ispasswordcrct) {
      return res.status(400).json({ message: "Invalid password" });
    }

    // 1. Time-gate for Mobile (10 AM - 1 PM IST)
    const nowIST = moment().tz("Asia/Kolkata");
    const hour = nowIST.hour();
    const isMobile = deviceType === "mobile" || deviceType === "tablet";

    if (isMobile && (hour < 10 || hour >= 13)) {
      await recordLoginHistory(req, exisitinguser._id, "NONE", "BLOCKED");
      return res.status(403).json({
        message: "Mobile access is only allowed between 10 AM and 1 PM IST.",
      });
    }

    // 2. Browser Rules
    const isChrome = browserName.includes("CHROME");
    const isMicrosoft = browserName.includes("EDGE") || browserName.includes("IE");

    if (isChrome) {
      // Generate OTP
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      await Otp.create({
        userId: exisitinguser._id,
        otp: otpCode,
        email: exisitinguser.email,
      });

      // FIRE AND FORGET: Email and History recording in background
      // This ensures the user is redirected to the OTP screen INSTANTLY
      sendOtpEmail(exisitinguser.email, otpCode);
      recordLoginHistory(req, exisitinguser._id, "OTP", "PENDING_OTP");

      console.log(`>>> SECURITY LOG: OTP for ${exisitinguser.email} is [ ${otpCode} ] <<<`);

      return res.status(200).json({
        otpRequired: true,
        message: "OTP sent to your email.",
        userId: exisitinguser._id,
      });
    }

    // If Microsoft browser or others (defaulting to allow if not Chrome/Mobile block)
    const token = jwt.sign(
      { email: exisitinguser.email, id: exisitinguser._id },
      process.env.JWT_SECRET || "default_secret",
      { expiresIn: "1h" }
    );

    await recordLoginHistory(req, exisitinguser._id, isMicrosoft ? "NONE" : "PASSWORD", "SUCCESS");

    res.status(200).json({ data: exisitinguser, token });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ message: error.message || "Something went wrong during login" });
  }
};

export const verifyOTP = async (req, res) => {
  const { userId, otp } = req.body;
  try {
    const otpRecord = await Otp.findOne({ userId, otp });
    if (!otpRecord) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    const exisitinguser = await user.findById(userId);
    const token = jwt.sign(
      { email: exisitinguser.email, id: exisitinguser._id },
      process.env.JWT_SECRET || "default_secret",
      { expiresIn: "1h" }
    );

    // Update login history to success
    await LoginHistory.findOneAndUpdate(
      { userId, status: "PENDING_OTP" },
      { status: "SUCCESS" },
      { sort: { loginTime: -1 } }
    );

    await Otp.deleteOne({ _id: otpRecord._id });

    res.status(200).json({ data: exisitinguser, token });
  } catch (error) {
    res.status(500).json({ message: "OTP verification failed" });
  }
};

export const getLoginHistory = async (req, res) => {
  const { userId } = req.params;
  try {
    const history = await LoginHistory.find({ userId }).sort({ loginTime: -1 });
    res.status(200).json(history);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch login history" });
  }
};
export const getallusers = async (req, res) => {
  try {
    const alluser = await user.find();
    res.status(200).json({ data: alluser });
  } catch (error) {
    res.status(500).json("something went wrong..");
    return;
  }
};
export const updateprofile = async (req, res) => {
  const { id: _id } = req.params;
  const { name, about, tags } = req.body.editForm;
  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(400).json({ message: "User unavailable" });
  }
  try {
    const updateprofile = await user.findByIdAndUpdate(
      _id,
      { $set: { name: name, about: about, tags: tags } },
      { new: true }
    );
    res.status(200).json({ data: updateprofile });
  } catch (error) {
    console.log(error);
    res.status(500).json("something went wrong..");
    return;
  }
};
