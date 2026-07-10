const nodemailer = require("nodemailer");
const envVariables = require("./envVariables");

/**
 * Sends a password reset email using Nodemailer.
 * If SMTP credentials are not fully configured in the environment,
 * it will output a warning and log the email content to the console
 * (fallback for development/testing environments).
 * 
 * @param {string} toEmail - Recipient email address
 * @param {string} resetLink - Password reset link containing JWT token
 * @returns {Promise<boolean>} True if sent successfully (or logged in dev)
 */
const sendPasswordResetEmail = async (toEmail, resetLink) => {
  const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM } = envVariables;

  // Check if SMTP is configured
  const isSmtpConfigured = SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASSWORD;

  if (!isSmtpConfigured) {
    console.warn("\n--- [SMTP NOT CONFIGURED] ---");
    console.warn("Please configure SMTP_USER and SMTP_PASSWORD in your environment / .env file.");
    console.warn(`Simulating email to: ${toEmail}`);
    console.warn(`Reset Link: ${resetLink}`);
    console.warn("-----------------------------\n");
    return true;
  }

  // Configure Nodemailer transporter
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: parseInt(SMTP_PORT, 10),
    secure: parseInt(SMTP_PORT, 10) === 465, // True for 465, false for other ports
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASSWORD,
    },
  });

  const mailOptions = {
    from: EMAIL_FROM,
    to: toEmail,
    subject: "Reset Your Password - Food App",
    text: `Hello,\n\nYou requested a password reset. Please click on the link below to reset your password:\n\n${resetLink}\n\nThis link is valid for 15 minutes.\n\nIf you did not request this, please ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 5px;">
        <h2 style="color: #2ecc71; text-align: center;">Food App Password Reset</h2>
        <p>Hello,</p>
        <p>You requested a password reset. Click the button below to set a new password. This link is valid for 15 minutes:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background-color: #2ecc71; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Reset Password</a>
        </div>
        <p>If the button doesn't work, you can also copy and paste the following link into your browser:</p>
        <p style="word-break: break-all; color: #3498db;"><a href="${resetLink}">${resetLink}</a></p>
        <hr style="border: 0; border-top: 1px solid #eeeeee; margin: 20px 0;">
        <p style="font-size: 12px; color: #7f8c8d;">If you did not request this password reset, please ignore this email.</p>
      </div>
    `,
  };

  try {
    const info = await transporter.sendMail(mailOptions);
    console.log(`Password reset email sent: ${info.messageId}`);
    return true;
  } catch (error) {
    console.error("Error sending password reset email via SMTP:", error);
    throw new Error("Failed to send password reset email. Please try again later.");
  }
};

module.exports = {
  sendPasswordResetEmail,
};
