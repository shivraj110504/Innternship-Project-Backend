import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export const sendSubscriptionInvoiceEmail = async ({
  email,
  userName,
  plan,
  amount,
  invoiceUrl,
  subscriptionId,
  currentPeriodEnd,
}) => {
  try {
    const planDetails = {
      BRONZE: { name: "Bronze Plan", limit: "5 questions/day" },
      SILVER: { name: "Silver Plan", limit: "10 questions/day" },
      GOLD: { name: "Gold Plan", limit: "Unlimited questions" },
    };

    const selectedPlan = planDetails[plan] || planDetails.BRONZE;
    const formattedAmount = (amount / 100).toFixed(2);
    const periodEnd = new Date(currentPeriodEnd).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .invoice-box { background: white; padding: 20px; margin: 20px 0; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    .invoice-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
    .invoice-row:last-child { border-bottom: none; font-weight: bold; font-size: 1.2em; color: #667eea; }
    .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin-top: 20px; }
    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 0.9em; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎉 Subscription Activated!</h1>
    </div>
    <div class="content">
      <p>Dear <strong>${userName}</strong>,</p>
      
      <p>Thank you for subscribing to <strong>${selectedPlan.name}</strong>! Your payment has been processed successfully.</p>
      
      <div class="invoice-box">
        <h3 style="margin-top: 0;">Invoice Details</h3>
        <div class="invoice-row">
          <span>Plan:</span>
          <span><strong>${selectedPlan.name}</strong></span>
        </div>
        <div class="invoice-row">
          <span>Question Limit:</span>
          <span>${selectedPlan.limit}</span>
        </div>
        <div class="invoice-row">
          <span>Billing Period:</span>
          <span>Monthly</span>
        </div>
        <div class="invoice-row">
          <span>Next Billing Date:</span>
          <span>${periodEnd}</span>
        </div>
        <div class="invoice-row">
          <span>Subscription ID:</span>
          <span style="font-size: 0.85em;">${subscriptionId}</span>
        </div>
        <div class="invoice-row">
          <span>Total Amount:</span>
          <span>₹${formattedAmount}</span>
        </div>
      </div>
      
      ${invoiceUrl ? `<a href="${invoiceUrl}" class="button">Download Invoice</a>` : ''}
      
      <p style="margin-top: 30px;">You can now enjoy your subscription benefits:</p>
      <ul>
        <li>✅ ${selectedPlan.limit}</li>
        <li>✅ Priority support</li>
        <li>✅ Access to premium features</li>
      </ul>
      
      <div class="footer">
        <p>Questions? Contact us at support@shivrajtaware.in</p>
        <p>&copy; ${new Date().getFullYear()} StackOverflow Clone. All rights reserved.</p>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    const response = await resend.emails.send({
      from: process.env.EMAIL_FROM || "StackOverflow <auth@shivrajtaware.in>",
      to: email,
      subject: `Payment Successful - ${selectedPlan.name} Activated`,
      html: htmlContent,
    });

    if (response.error) {
      console.error("[EMAIL] Failed to send invoice:", response.error);
      return false;
    }

    console.log("[EMAIL] Invoice sent successfully:", response.data.id);
    return true;
  } catch (error) {
    console.error("[EMAIL] Error sending invoice:", error);
    return false;
  }
};