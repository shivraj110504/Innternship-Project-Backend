import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

// Create reusable transporter
let transporter = null;

const createTransporter = () => {
  if (transporter) return transporter;

  // Check if email service is configured
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn("⚠️ Email service not configured - emails will be logged only");
    return null;
  }

  transporter = nodemailer.createTransporter({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  return transporter;
};

// Send subscription invoice email
export const sendSubscriptionInvoiceEmail = async (
  to,
  userName,
  plan,
  amount,
  currency,
  invoiceUrl
) => {
  try {
    const transporter = createTransporter();
    
    // If no transporter, just log
    if (!transporter) {
      console.log("📧 Email would be sent to:", to);
      console.log("📄 Invoice details:", { userName, plan, amount, currency, invoiceUrl });
      return { success: true, message: "Email service not configured - logged only" };
    }

    const mailOptions = {
      from: `"StackOverflow Clone" <${process.env.EMAIL_USER}>`,
      to,
      subject: `Payment Confirmation - ${plan} Subscription`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
            .content { background: #f9f9f9; padding: 30px; margin-top: 20px; }
            .invoice-box { background: white; padding: 20px; margin: 20px 0; border-left: 4px solid #4F46E5; }
            .button { 
              display: inline-block; 
              background: #4F46E5; 
              color: white; 
              padding: 12px 30px; 
              text-decoration: none; 
              border-radius: 5px;
              margin-top: 20px;
            }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Payment Confirmation</h1>
            </div>
            
            <div class="content">
              <p>Hi ${userName},</p>
              
              <p>Thank you for subscribing to our <strong>${plan}</strong> plan! Your payment has been processed successfully.</p>
              
              <div class="invoice-box">
                <h3>Invoice Details</h3>
                <p><strong>Plan:</strong> ${plan}</p>
                <p><strong>Amount Paid:</strong> ${currency} ${amount.toFixed(2)}</p>
                <p><strong>Date:</strong> ${new Date().toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}</p>
              </div>
              
              ${invoiceUrl ? `<a href="${invoiceUrl}" class="button">Download Invoice</a>` : ""}
              
              <p style="margin-top: 30px;">Your subscription is now active! You can start enjoying all the benefits of your ${plan} plan.</p>
              
              <p>If you have any questions, feel free to contact our support team.</p>
              
              <p>Best regards,<br>The StackOverflow Clone Team</p>
            </div>
            
            <div class="footer">
              <p>This is an automated email. Please do not reply to this message.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Email sent successfully:", info.messageId);
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Error sending email:", error);
    return { success: false, error: error.message };
  }
};

// Send OTP email for password reset
export const sendPasswordResetOTPEmail = async (to, otp, userName) => {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      console.log("📧 Password Reset OTP would be sent to:", to, "OTP:", otp);
      return { success: true, message: "Email service not configured - logged only" };
    }

    const mailOptions = {
      from: `"StackOverflow Clone" <${process.env.EMAIL_USER}>`,
      to,
      subject: "Password Reset - Your OTP Code",
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
            .content { background: #f9f9f9; padding: 30px; margin-top: 20px; border-radius: 8px; }
            .otp-box { 
              background: white; 
              padding: 20px; 
              margin: 20px 0; 
              text-align: center;
              border: 2px dashed #4F46E5;
              border-radius: 8px;
            }
            .otp-code {
              font-size: 32px;
              font-weight: bold;
              color: #4F46E5;
              letter-spacing: 8px;
              margin: 10px 0;
            }
            .warning { 
              background: #FEF3C7; 
              border-left: 4px solid #F59E0B;
              padding: 12px;
              margin: 20px 0;
            }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Password Reset Request</h1>
            </div>
            
            <div class="content">
              <p>Hi ${userName || 'User'},</p>
              
              <p>We received a request to reset your password. Use the OTP code below to complete the process:</p>
              
              <div class="otp-box">
                <p style="margin: 0; color: #666; font-size: 14px;">Your OTP Code</p>
                <div class="otp-code">${otp}</div>
                <p style="margin: 0; color: #666; font-size: 12px;">Valid for 5 minutes</p>
              </div>
              
              <div class="warning">
                <strong>⚠️ Security Notice:</strong>
                <ul style="margin: 5px 0;">
                  <li>This OTP will expire in 5 minutes</li>
                  <li>Never share this code with anyone</li>
                  <li>You can only request password reset once per day</li>
                </ul>
              </div>
              
              <p>If you didn't request this password reset, please ignore this email and your password will remain unchanged.</p>
              
              <p>Best regards,<br>The StackOverflow Clone Team</p>
            </div>
            
            <div class="footer">
              <p>This is an automated email. Please do not reply to this message.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Password Reset OTP email sent:", info.messageId);
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Error sending password reset OTP email:", error);
    return { success: false, error: error.message };
  }
};

// Send OTP email for login
export const sendOTPEmail = async (to, otp, userName) => {
  try {
    const transporter = createTransporter();
    
    if (!transporter) {
      console.log("📧 Login OTP would be sent to:", to, "OTP:", otp);
      return { success: true, message: "Email service not configured - logged only" };
    }

    const mailOptions = {
      from: `"StackOverflow Clone" <${process.env.EMAIL_USER}>`,
      to,
      subject: "Your Login OTP Code",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Login OTP</h2>
          <p>Hi ${userName || 'User'},</p>
          <p>Your OTP for login is:</p>
          <h1 style="background: #4F46E5; color: white; padding: 20px; text-align: center; letter-spacing: 5px;">${otp}</h1>
          <p>This OTP will expire in 10 minutes.</p>
          <p>If you didn't request this OTP, please ignore this email.</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("✅ Login OTP email sent:", info.messageId);
    
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error("❌ Error sending OTP email:", error);
    return { success: false, error: error.message };
  }
};

export default {
  sendSubscriptionInvoiceEmail,
  sendPasswordResetOTPEmail,
  sendOTPEmail,
};