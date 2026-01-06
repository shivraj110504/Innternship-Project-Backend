import { UAParser } from "ua-parser-js";
import LoginHistory from "../models/LoginHistory.js";

export const loginUser = async (req, res) => {
  try {
    // 1. Capture IP address
    const ip =
      req.headers["x-forwarded-for"]?.split(",")[0] ||
      req.socket.remoteAddress;

    // 2. Capture browser / OS / device
    const parser = new UAParser(req.headers["user-agent"]);
    const { browser, os, device } = parser.getResult();

    // 3. Validate credentials
    const { email, password } = req.body;
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }



    // 4. Enforce mobile time restriction
    const hour = new Date().getHours();
    if (device.type === "mobile" && (hour < 10 || hour >= 13)) {
      return res.status(403).json({
        message: "Mobile access allowed only between 10 AM and 1 PM",
      });
    }

    // 5. Decide OTP requirement
    const isChrome = browser.name === "Chrome";
    const isEdge = browser.name === "Edge";

    if (isChrome) {
      // trigger OTP
      await triggerOtp(user);

      // store login attempt
      await LoginHistory.create({
        userId: user._id,
        ipAddress: ip,
        browser: browser.name,
        os: os.name,
        deviceType: device.type || "desktop",
        loginMethod: "OTP",
      });

      return res.json({
        otpRequired: true,
        userId: user._id,
      });
    }

    // 6. Edge → no OTP
    const token = issueJWT(user);

    await LoginHistory.create({
      userId: user._id,
      ipAddress: ip,
      browser: browser.name,
      os: os.name,
      deviceType: device.type || "desktop",
      loginMethod: "EDGE_NO_OTP",
    });

    return res.json({
      data: user,
      token,
    });
  } catch (err) {
    return res.status(500).json({ message: "Login failed" });
  }
};
