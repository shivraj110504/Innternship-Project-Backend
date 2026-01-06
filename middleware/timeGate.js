import moment from "moment-timezone";
import { UAParser } from "ua-parser-js";

const timeGate = (req, res, next) => {
    const userAgent = req.headers["user-agent"] || "";
    const parser = new UAParser(userAgent);
    const deviceType = parser.getDevice().type || "desktop";

    const isMobile = deviceType === "mobile" || deviceType === "tablet";

    if (isMobile) {
        const nowIST = moment().tz("Asia/Kolkata");
        const hour = nowIST.hour();

        // 10 AM to 1 PM (10:00 to 12:59)
        if (hour < 10 || hour >= 13) {
            return res.status(403).json({
                message: "Mobile access is only allowed between 10 AM and 1 PM IST."
            });
        }
    }

    next();
};

export default timeGate;
