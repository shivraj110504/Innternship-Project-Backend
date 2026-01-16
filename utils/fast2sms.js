import https from "https";

const FAST2SMS_API_KEY = "a1PICzbxkFslwldcFLIjWulYrVrBNrmBk486L0o7tEkYS1IjbPGpgnCHkt4h";

export const sendFast2Sms = async ({ message, numbers }) => {
    return new Promise((resolve, reject) => {
        const url = new URL("https://www.fast2sms.com/dev/bulkV2");
        url.searchParams.append("authorization", process.env.FAST2SMS_API_KEY || FAST2SMS_API_KEY);
        url.searchParams.append("route", "q");
        url.searchParams.append("message", message);
        url.searchParams.append("language", "english");
        url.searchParams.append("flash", "0");
        url.searchParams.append("numbers", numbers); // comma separated if multiple

        console.log(`[FAST2SMS] Sending SMS to ${numbers}: ${message}`);

        https.get(url.toString(), (res) => {
            let data = "";

            res.on("data", (chunk) => {
                data += chunk;
            });

            res.on("end", () => {
                try {
                    const response = JSON.parse(data);
                    console.log("[FAST2SMS] Response:", response);
                    if (response.return === true) {
                        resolve(response);
                    } else {
                        reject(new Error(response.message || "Fast2SMS failed"));
                    }
                } catch (err) {
                    reject(err);
                }
            });
        }).on("error", (err) => {
            console.error("[FAST2SMS] Error:", err);
            reject(err);
        });
    });
};
