import mongoose from "mongoose";
import user from "../models/auth.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { UAParser } from "ua-parser-js";
import moment from "moment-timezone";
import { Resend } from "resend";
import LoginHistory from "../models/LoginHistory.js";
import Otp from "../models/Otp.js";
import { generateRandomPassword } from "../utils/passwordUtils.js";
import https from "https";
import { sendFast2Sms } from "../utils/fast2sms.js";

// ==========================================
// HELPER FUNCTION FOR SETTING AUTH COOKIES
// ==========================================
const setAuthCookie = (res, token) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const maxAge = 365 * 24 * 60 * 60 * 1000; // 1 year

  res.cookie('token', token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: maxAge,
    path: '/',
  });

  console.log(`✅ Cookie set: secure=${isProduction}, sameSite=${isProduction ? 'none' : 'lax'}`);
};

export const awardBadges = async (userId) => {
  try {
    const userDoc = await user.findById(userId);
    if (!userDoc) return;

    let points = userDoc.points || 0;
    let gold = 0;
    let silver = 0;
    let bronze = 0;

    // Bronze: 10 pts, Silver: 50 pts, Gold: 100 pts
    if (points >= 100) gold = 1;
    if (points >= 50) silver = 1;
    if (points >= 10) bronze = 1;

    await user.findByIdAndUpdate(userId, {
      $set: {
        goldBadges: gold,
        silverBadges: silver,
        bronzeBadges: bronze
      }
    });
  } catch (e) {
    console.log("Badge error:", e);
  }
};

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

// Change password for authenticated user
export const changePassword = async (req, res) => {
  try {
    const userId = req.userid;
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Current and new password are required" });
    }

    const existing = await user.findById(userId);
    if (!existing) return res.status(404).json({ message: "User not found" });

    const ok = await bcrypt.compare(currentPassword, existing.password);
    if (!ok) return res.status(400).json({ message: "Current password is incorrect" });

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "New password must be at least 6 characters" });
    }

    const hash = await bcrypt.hash(newPassword, 12);
    existing.password = hash;
    await existing.save();
    return res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Change Password Error:", error);
    return res.status(500).json({ message: "Failed to change password" });
  }
};

// Send reset OTP by phone directly
export const forgotPasswordByPhone = async (req, res) => {
  const { phone } = req.body;
  if (!phone) return res.status(400).json({ message: "Phone number is required" });
  try {
    const existingUser = await user.findOne({ phone });
    if (!existingUser) {
      return res.status(404).json({ message: "User with this phone not found" });
    }

    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
    await Otp.create({
      userId: existingUser._id,
      otp: otpCode,
      email: existingUser.email,
      phone: existingUser.phone,
    });

    try {
      await sendFast2Sms({
        message: `Your OTP for password reset is ${otpCode}.`,
        numbers: existingUser.phone,
      });
    } catch (smsError) {
      console.error("Fast2SMS Error:", smsError);
      return res.status(500).json({ message: "Failed to send SMS OTP. Please try again later." });
    }

    res.status(200).json({ message: "OTP sent to your mobile number." });
  } catch (error) {
    console.error("Forgot Password (phone) Error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

// Transfer points between users
export const transferPoints = async (req, res) => {
  const { fromUserId, toUserId, amount } = req.body;
  const amt = Number(amount);
  if (!fromUserId || !toUserId || !amt || amt <= 0) {
    return res.status(400).json({ message: "Invalid transfer request" });
  }
  if (fromUserId === toUserId) {
    return res.status(400).json({ message: "Cannot transfer to self" });
  }
  try {
    const from = await user.findById(fromUserId);
    const to = await user.findById(toUserId);
    if (!from || !to) return res.status(404).json({ message: "User not found" });
    if ((from.points || 0) < 10) return res.status(403).json({ message: "Need at least 10 points to transfer" });
    if (from.points < amt) return res.status(400).json({ message: "Insufficient points" });

    from.points -= amt;
    to.points = (to.points || 0) + amt;
    await from.save();
    await to.save();

    await awardBadges(fromUserId);
    await awardBadges(toUserId);

    res.status(200).json({ message: "Transfer successful", fromPoints: from.points, toPoints: to.points });
  } catch (error) {
    console.error("Transfer Points Error:", error);
    res.status(500).json({ message: "Failed to transfer points" });
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
  let { name, email, password, phone, handle } = req.body;
  console.log("Signup attempt for:", email);
  try {
    const exisitinguser = await user.findOne({ email });
    if (exisitinguser) {
      console.log("User already exists:", email);
      return res.status(400).json({ message: "User already exist" });
    }
    
    if (phone) {
      phone = String(phone).replace(/\D/g, "");
      if (phone.length < 10) {
        return res.status(400).json({ message: "Invalid phone number" });
      }
      const phoneExists = await user.findOne({ phone });
      if (phoneExists) {
        return res.status(400).json({ message: "Phone number already in use" });
      }
    }

    // Generate unique handle if not provided
    if (!handle) {
      let baseHandle = name.toLowerCase().replace(/\s+/g, "");
      handle = baseHandle;
      let counter = 1;
      
      while (await user.findOne({ handle })) {
        handle = `${baseHandle}${counter}`;
        counter++;
      }
    } else {
      const handleExists = await user.findOne({ handle });
      if (handleExists) {
        return res.status(400).json({ message: "Handle already in use" });
      }
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
      handle,
      ...(phone ? { phone } : {}),
      friends: [],
      sentFriendRequests: [],
      receivedFriendRequests: [],
      goldBadges: 0,
      silverBadges: 0,
      bronzeBadges: 0,
    });

    const countAfter = await user.countDocuments();
    console.log("User count after create:", countAfter);
    console.log("Created user ID:", newuser._id, "with handle:", handle);

    console.log("User created, generating token...");
    const token = jwt.sign(
      { email: newuser.email, id: newuser._id },
      process.env.JWT_SECRET || "default_secret",
      { expiresIn: "36500d" }
    );

    await recordLoginHistory(req, newuser._id, "PASSWORD", "SUCCESS");

    // FIXED: Use helper function
    setAuthCookie(res, token);

    console.log("Signup successful for:", email);
    res.status(200).json({ data: newuser });
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
      return res.status(400).json({ message: "User does not exist" });
    }

    const ispasswordcrct = await bcrypt.compare(password, exisitinguser.password);
    if (!ispasswordcrct) {
      return res.status(400).json({ message: "Invalid password" });
    }

    const nowIST = moment().tz("Asia/Kolkata");
    const hour = nowIST.hour();
    const isMobile = deviceType === "mobile" || deviceType === "tablet";

    if (isMobile && (hour < 10 || hour >= 13)) {
      await recordLoginHistory(req, exisitinguser._id, "NONE", "BLOCKED");
      return res.status(403).json({
        message: "Mobile access is only allowed between 10 AM and 1 PM IST.",
      });
    }

    const isChrome = browserName.includes("CHROME");
    const isMicrosoft = browserName.includes("EDGE") || browserName.includes("IE");

    if (isChrome) {
      const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
      await Otp.create({
        userId: exisitinguser._id,
        otp: otpCode,
        email: exisitinguser.email,
      });

      sendOtpEmail(exisitinguser.email, otpCode);
      recordLoginHistory(req, exisitinguser._id, "OTP", "PENDING_OTP");

      console.log(`>>> SECURITY LOG: OTP for ${exisitinguser.email} is [ ${otpCode} ] <<<`);

      return res.status(200).json({
        otpRequired: true,
        message: "OTP sent to your email.",
        userId: exisitinguser._id,
      });
    }

    const token = jwt.sign(
      { email: exisitinguser.email, id: exisitinguser._id },
      process.env.JWT_SECRET || "default_secret",
      { expiresIn: "36500d" }
    );

    await recordLoginHistory(req, exisitinguser._id, isMicrosoft ? "NONE" : "PASSWORD", "SUCCESS");

    // FIXED: Use helper function
    setAuthCookie(res, token);

    res.status(200).json({ data: exisitinguser });
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
      { expiresIn: "36500d" }
    );

    await LoginHistory.findOneAndUpdate(
      { userId, status: "PENDING_OTP" },
      { status: "SUCCESS" },
      { sort: { loginTime: -1 } }
    );

    await Otp.deleteOne({ _id: otpRecord._id });

    // FIXED: Use helper function
    setAuthCookie(res, token);

    res.status(200).json({ data: exisitinguser });
  } catch (error) {
    res.status(500).json({ message: "OTP verification failed" });
  }
};

export const Logout = async (req, res) => {
  // FIXED: Use clearCookie properly
  res.clearCookie('token', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
  });
  
  res.status(200).json({ message: "Logged out successfully" });
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
  const { name, about, tags, phone, handle } = req.body.editForm || {};
  if (!req.body.editForm) {
    return res.status(400).json({ message: "Form data is missing" });
  }
  if (!mongoose.Types.ObjectId.isValid(_id)) {
    return res.status(400).json({ message: "User unavailable" });
  }
  try {
    const update = { name, about, tags, handle };
    if (phone !== undefined) {
      const normalized = String(phone).replace(/\D/g, "");
      if (normalized && normalized.length < 10) {
        return res.status(400).json({ message: "Invalid phone number" });
      }
      if (normalized) {
        const other = await user.findOne({ phone: normalized, _id: { $ne: _id } });
        if (other) {
          return res.status(400).json({ message: "Phone number already in use" });
        }
        update.phone = normalized;
      } else {
        update.phone = undefined;
      }
    }
    const updateprofile = await user.findByIdAndUpdate(_id, { $set: update }, { new: true });
    res.status(200).json({ data: updateprofile });
  } catch (error) {
    console.log(error);
    res.status(500).json("something went wrong..");
    return;
  }
};

export const getUser = async (req, res) => {
  const { id } = req.params;
  try {
    const userData = await user.findById(id).select("-password");
    if (!userData) return res.status(404).json({ message: "User not found" });
    res.status(200).json(userData);
  } catch (error) {
    res.status(500).json({ message: "Something went wrong" });
  }
};

const fetchPhoneEmailUser = (userJsonUrl) => {
  return new Promise((resolve, reject) => {
    https.get(userJsonUrl, (res) => {
      let data = "";

      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(err);
        }
      });
    }).on("error", reject);
  });
};

export const verifyPhoneEmail = async (req, res) => {
  return res.status(410).json({ message: "This verification method is deprecated. Please use OTP." });
};

export const forgotPassword = async (req, res) => {
  const { email } = req.body;
  try {
    const existingUser = await user.findOne({ email });
    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    const hasPhone = !!existingUser.phone;
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    await Otp.create({
      userId: existingUser._id,
      otp: otpCode,
      email: existingUser.email,
      ...(hasPhone ? { phone: existingUser.phone } : {})
    });

    try {
      if (hasPhone) {
        await sendFast2Sms({
          message: `Your OTP for password reset is ${otpCode}.`,
          numbers: existingUser.phone
        });
      }
      await sendOtpEmail(existingUser.email, otpCode);
    } catch (sendError) {
      console.error("OTP Send Error:", sendError);
    }

    res.status(200).json({
      message: "OTP sent to your registered mobile and email.",
      phone: existingUser.phone
    });

  } catch (error) {
    console.error("Forgot Password Error:", error);
    res.status(500).json({ message: "Something went wrong" });
  }
};

export const resetPasswordWithOtp = async (req, res) => {
  const { phone, otp } = req.body;

  if (!phone || !otp) {
    return res.status(400).json({ message: "Phone number and OTP are required" });
  }

  try {
    const otpRecord = phone
      ? await Otp.findOne({ phone, otp })
      : await Otp.findOne({ email: req.body.email, otp });

    if (!otpRecord) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    const existingUser = await user.findById(otpRecord.userId);
    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (existingUser.phone !== phone) {
      return res.status(400).json({ message: "Phone number does not match record" });
    }

    const newPassword = generateRandomPassword(10);
    const hashpassword = await bcrypt.hash(newPassword, 12);

    existingUser.password = hashpassword;
    existingUser.forgotPasswordAt = new Date();
    await existingUser.save();

    await Otp.deleteOne({ _id: otpRecord._id });

    res.status(200).json({
      message: "Password reset successful.",
      newPassword: newPassword
    });

  } catch (error) {
    console.error("Reset Password OTP Error:", error);
    res.status(500).json({ message: "Something went wrong during password reset" });
  }
};