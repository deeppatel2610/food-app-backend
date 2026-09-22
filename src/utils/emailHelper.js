const nodemailer = require("nodemailer");
const envVariables = require("./envVariables");

/**
 * Creates and returns a Nodemailer SMTP transporter using Brevo SMTP credentials
 */
const getTransporter = () => {
  const host = envVariables.SMTP_HOST || "smtp-relay.brevo.com";
  const port = parseInt(envVariables.SMTP_PORT, 10) || 587;
  const user = envVariables.SMTP_USER;
  const pass = envVariables.SMTP_PASSWORD;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465, // false for 587 (STARTTLS)
    auth: {
      user,
      pass,
    },
  });
};

/**
 * Returns formatted sender string
 */
const getFromAddress = () => {
  const name = envVariables.EMAIL_FROM_NAME || "Food App";
  const email = envVariables.EMAIL_FROM || "deeppatel100267@gmail.com";
  return `"${name}" <${email}>`;
};

/**
 * Helper to print detailed, colorful email logs in terminal
 */
const printEmailLog = ({
  title,
  from,
  toEmail,
  firstName,
  otpCode,
  subject,
  textContent,
  provider,
  result,
  error,
}) => {
  console.log("\n" + "=".repeat(70));
  console.log(` 📧 EMAIL DISPATCH LOG - [${title.toUpperCase()}]`);
  console.log("-".repeat(70));
  console.log(` ▶ SENDER (FROM)   : ${from}`);
  console.log(` ▶ RECEIVER (TO)   : ${toEmail} (${firstName || "User"})`);
  if (otpCode) {
    console.log(` ▶ OTP CODE        : \x1b[32m\x1b[1m👉 ${otpCode} 👈\x1b[0m`);
  }
  console.log(` ▶ SUBJECT         : ${subject}`);
  console.log(` ▶ PROVIDER        : ${provider}`);
  console.log("-".repeat(70));
  console.log(" 📄 FULL MESSAGE CONTENT:");
  console.log(textContent.trim().split("\n").map(l => "   " + l).join("\n"));
  console.log("-".repeat(70));

  if (error) {
    console.log(` ❌ RESULT          : \x1b[31mFAILED\x1b[0m`);
    console.log(` ⚠️ ERROR DETAILS   : ${error.message || error}`);
  } else {
    console.log(` ✅ RESULT          : \x1b[32mSUCCESS / DELIVERED\x1b[0m`);
    if (result) {
      console.log(` 🆔 MESSAGE ID      : ${result.messageId || "N/A"}`);
      console.log(` 📊 RESPONSE        : ${result.response || "Sent"}`);
    }
  }
  console.log("=".repeat(70) + "\n");
};

/**
 * Sends a 6-digit registration verification OTP code to user's email via Brevo SMTP
 * 
 * @param {string} toEmail - User's email address
 * @param {string} otpCode - 6-digit OTP code
 * @param {string} firstName - User's first name
 * @returns {Promise<boolean>} True if sent successfully, false otherwise
 */
const sendOtpEmail = async (toEmail, otpCode, firstName = "User") => {
  const from = getFromAddress();
  const subject = `${otpCode} is your Food App verification OTP`;

  const textContent = `
Hello ${firstName},

Thank you for registering with Food App!
Your 6-Digit Email Verification Code (OTP) is: ${otpCode}

This code will expire in 10 minutes. Please enter it in the app to complete registration.
If you did not request this, please ignore this email.
`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
      <div style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <div style="background-color: #10b981; padding: 24px; text-align: center;">
          <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Food App</h1>
          <p style="margin: 6px 0 0; color: #d1fae5; font-size: 14px;">Account Registration Verification</p>
        </div>

        <div style="padding: 28px;">
          <p style="font-size: 16px; margin-top: 0;">Hello <strong>${firstName}</strong>,</p>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">
            Thank you for signing up with Food App! Use the 6-digit One-Time Password (OTP) below to complete your registration:
          </p>

          <div style="text-align: center; margin: 28px 0;">
            <div style="display: inline-block; background-color: #f0fdf4; border: 2px dashed #10b981; border-radius: 10px; padding: 14px 32px;">
              <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #047857; font-family: monospace;">${otpCode}</span>
            </div>
            <p style="font-size: 13px; color: #64748b; margin-top: 10px;">Valid for <strong>10 minutes</strong></p>
          </div>

          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 0; font-size: 13px; color: #92400e; line-height: 1.5;">
              <strong>Security Notice:</strong> Never share your OTP with anyone. Our support team will never ask for your verification code.
            </p>
          </div>

          <p style="font-size: 13px; color: #94a3b8; line-height: 1.5; margin-top: 24px;">
            If you did not initiate this registration, please disregard this email.
          </p>
        </div>

        <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px; text-align: center;">
          <p style="margin: 0; font-size: 12px; color: #94a3b8;">&copy; ${new Date().getFullYear()} Food App. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const transporter = getTransporter();
    const result = await transporter.sendMail({
      from,
      to: toEmail,
      subject,
      text: textContent,
      html: htmlContent,
    });

    printEmailLog({
      title: "Registration OTP Email",
      from,
      toEmail,
      firstName,
      otpCode,
      subject,
      textContent,
      provider: `Brevo SMTP (${envVariables.SMTP_HOST || "smtp-relay.brevo.com"})`,
      result,
    });

    return true;
  } catch (error) {
    printEmailLog({
      title: "Registration OTP Email",
      from,
      toEmail,
      firstName,
      otpCode,
      subject,
      textContent,
      provider: `Brevo SMTP (${envVariables.SMTP_HOST || "smtp-relay.brevo.com"})`,
      error,
    });
    return false;
  }
};

/**
 * Sends a 6-digit password reset OTP code and link to user's email via Brevo SMTP
 * 
 * @param {string} toEmail - Recipient email address
 * @param {string} resetLink - Password reset link containing JWT token
 * @param {string} firstName - Recipient's name
 * @param {string} resetCode - 6-digit password reset OTP code
 * @returns {Promise<boolean>} True if sent successfully, false otherwise
 */
const sendPasswordResetEmail = async (toEmail, resetLink, firstName = "User", resetCode = null) => {
  const from = getFromAddress();
  const subject = resetCode
    ? `${resetCode} is your Food App password reset code`
    : "Reset Your Password - Food App";

  const textContent = `
Hello ${firstName},

You requested to reset your Food App password.

${resetCode ? `Your 6-Digit Password Reset OTP Code is: ${resetCode}\n` : ""}
${resetLink ? `Or click the link below to reset your password online:\n${resetLink}\n` : ""}
This code and link are valid for 15 minutes.
If you did not request a password reset, you can safely ignore this email.
`;

  const codeBoxHtml = resetCode
    ? `
      <p style="font-size: 14px; color: #475569; margin-top: 20px; margin-bottom: 8px; text-align: center;">Enter this 6-digit OTP code in your app to reset your password:</p>
      <div style="text-align: center; margin: 16px 0;">
        <div style="display: inline-block; background-color: #f0fdf4; border: 2px dashed #10b981; border-radius: 10px; padding: 14px 32px;">
          <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #047857; font-family: monospace;">${resetCode}</span>
        </div>
        <p style="font-size: 13px; color: #64748b; margin-top: 8px;">Valid for <strong>15 minutes</strong></p>
      </div>
    `
    : "";

  const linkButtonHtml = resetLink
    ? `
      <div style="text-align: center; margin: 24px 0;">
        <p style="text-align: center; color: #94a3b8; font-size: 12px; margin-bottom: 16px;">— OR RESET VIA BROWSER —</p>
        <a href="${resetLink}" style="background-color: #10b981; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px; display: inline-block;">Reset Password Online</a>
      </div>
      <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; text-align: center; word-break: break-all;">
        Or copy and paste this link: <a href="${resetLink}" style="color: #2563eb; text-decoration: underline;">${resetLink}</a>
      </p>
    `
    : "";

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
      <div style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <div style="background-color: #10b981; padding: 24px; text-align: center;">
          <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Food App</h1>
          <p style="margin: 6px 0 0; color: #d1fae5; font-size: 14px;">Password Reset Request</p>
        </div>

        <div style="padding: 28px;">
          <p style="font-size: 16px; margin-top: 0;">Hello <strong>${firstName}</strong>,</p>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">
            We received a request to reset your Food App password. Use the verification code below to set a new password:
          </p>

          ${codeBoxHtml}
          ${linkButtonHtml}

          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 0; font-size: 13px; color: #92400e; line-height: 1.5;">
              <strong>Security Notice:</strong> If you did not request a password reset, someone may be trying to access your account. You can safely ignore this email.
            </p>
          </div>
        </div>

        <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px; text-align: center;">
          <p style="margin: 0; font-size: 12px; color: #94a3b8;">&copy; ${new Date().getFullYear()} Food App. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const transporter = getTransporter();
    const result = await transporter.sendMail({
      from,
      to: toEmail,
      subject,
      text: textContent,
      html: htmlContent,
    });

    printEmailLog({
      title: "Password Reset OTP Email",
      from,
      toEmail,
      firstName,
      otpCode: resetCode,
      subject,
      textContent,
      provider: `Brevo SMTP (${envVariables.SMTP_HOST || "smtp-relay.brevo.com"})`,
      result,
    });

    return true;
  } catch (error) {
    printEmailLog({
      title: "Password Reset OTP Email",
      from,
      toEmail,
      firstName,
      otpCode: resetCode,
      subject,
      textContent,
      provider: `Brevo SMTP (${envVariables.SMTP_HOST || "smtp-relay.brevo.com"})`,
      error,
    });
    return false;
  }
};

/**
 * Sends a 6-digit profile update verification OTP code to user's email via Brevo SMTP
 * 
 * @param {string} toEmail - Recipient email address
 * @param {string} otpCode - 6-digit OTP code
 * @param {string} firstName - User's first name
 * @returns {Promise<boolean>} True if sent successfully, false otherwise
 */
const sendProfileUpdateOtpEmail = async (toEmail, otpCode, firstName = "User") => {
  const from = getFromAddress();
  const subject = `${otpCode} is your Food App profile update OTP`;

  const textContent = `
Hello ${firstName},

We received a request to update your Food App profile details.
Your 6-Digit Profile Update Verification Code (OTP) is: ${otpCode}

This code will expire in 10 minutes. Please enter this code in the app to confirm and apply your updates.
If you did not request this update, please ignore this email and ensure your account credentials are safe.
`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
      <div style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <div style="background-color: #10b981; padding: 24px; text-align: center;">
          <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Food App</h1>
          <p style="margin: 6px 0 0; color: #d1fae5; font-size: 14px;">Profile Update Verification</p>
        </div>

        <div style="padding: 28px;">
          <p style="font-size: 16px; margin-top: 0;">Hello <strong>${firstName}</strong>,</p>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">
            We received a request to update your Food App profile information. Please use the 6-digit One-Time Password (OTP) below to confirm your updates:
          </p>

          <div style="text-align: center; margin: 28px 0;">
            <div style="display: inline-block; background-color: #f0fdf4; border: 2px dashed #10b981; border-radius: 10px; padding: 14px 32px;">
              <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #047857; font-family: monospace;">${otpCode}</span>
            </div>
            <p style="font-size: 13px; color: #64748b; margin-top: 10px;">Valid for <strong>10 minutes</strong></p>
          </div>

          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 0; font-size: 13px; color: #92400e; line-height: 1.5;">
              <strong>Security Notice:</strong> Never share your verification code with anyone. If you didn't initiate this profile update, you can safely ignore this email.
            </p>
          </div>

          <p style="font-size: 13px; color: #94a3b8; line-height: 1.5; margin-top: 24px;">
            Thank you for keeping your profile up to date!
          </p>
        </div>

        <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px; text-align: center;">
          <p style="margin: 0; font-size: 12px; color: #94a3b8;">&copy; ${new Date().getFullYear()} Food App. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const transporter = getTransporter();
    const result = await transporter.sendMail({
      from,
      to: toEmail,
      subject,
      text: textContent,
      html: htmlContent,
    });

    printEmailLog({
      title: "Profile Update OTP Email",
      from,
      toEmail,
      firstName,
      otpCode,
      subject,
      textContent,
      provider: `Brevo SMTP (${envVariables.SMTP_HOST || "smtp-relay.brevo.com"})`,
      result,
    });

    return true;
  } catch (error) {
    printEmailLog({
      title: "Profile Update OTP Email",
      from,
      toEmail,
      firstName,
      otpCode,
      subject,
      textContent,
      provider: `Brevo SMTP (${envVariables.SMTP_HOST || "smtp-relay.brevo.com"})`,
      error,
    });
    return false;
  }
};

/**
 * Sends a 6-digit security authorization OTP code to user's OLD (current) email
 * when an email address change is requested.
 */
const sendOldEmailChangeOtpEmail = async (toEmail, otpCode, newEmail, firstName = "User") => {
  const from = getFromAddress();
  const subject = `${otpCode} is your authorization code to change your Food App email`;

  const textContent = `
Hello ${firstName},

We received a request to change the email address for your Food App account from ${toEmail} to ${newEmail}.
Your 6-Digit Authorization Code (Current Email OTP) is: ${otpCode}

This code will expire in 10 minutes. Enter this code in the app along with the code sent to your new email to confirm this change.
If you did NOT request this email change, please ignore this email and immediately change your password.
`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
      <div style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <div style="background-color: #ef4444; padding: 24px; text-align: center;">
          <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Food App Security</h1>
          <p style="margin: 6px 0 0; color: #fee2e2; font-size: 14px;">Authorize Email Address Change</p>
        </div>

        <div style="padding: 28px;">
          <p style="font-size: 16px; margin-top: 0;">Hello <strong>${firstName}</strong>,</p>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">
            We received a request to transfer your Food App account email address to:
          </p>
          <div style="background-color: #f1f5f9; padding: 10px 16px; border-radius: 6px; font-weight: 600; color: #0f172a; margin: 12px 0;">
            ${newEmail}
          </div>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">
            To authorize this transfer from your current email, please enter this <strong>Current Email Authorization OTP</strong>:
          </p>

          <div style="text-align: center; margin: 24px 0;">
            <div style="display: inline-block; background-color: #fef2f2; border: 2px dashed #ef4444; border-radius: 10px; padding: 14px 32px;">
              <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #b91c1c; font-family: monospace;">${otpCode}</span>
            </div>
            <p style="font-size: 13px; color: #64748b; margin-top: 10px;">Valid for <strong>10 minutes</strong></p>
          </div>

          <div style="background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 0; font-size: 13px; color: #92400e; line-height: 1.5;">
              <strong>Security Warning:</strong> If you did NOT request this email change, DO NOT share this code with anyone. Someone may be trying to access your account.
            </p>
          </div>
        </div>

        <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px; text-align: center;">
          <p style="margin: 0; font-size: 12px; color: #94a3b8;">&copy; ${new Date().getFullYear()} Food App. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const transporter = getTransporter();
    const result = await transporter.sendMail({
      from,
      to: toEmail,
      subject,
      text: textContent,
      html: htmlContent,
    });

    printEmailLog({
      title: "Current Email Change Auth OTP",
      from,
      toEmail,
      firstName,
      otpCode,
      subject,
      textContent,
      provider: `Brevo SMTP (${envVariables.SMTP_HOST || "smtp-relay.brevo.com"})`,
      result,
    });

    return true;
  } catch (error) {
    printEmailLog({
      title: "Current Email Change Auth OTP",
      from,
      toEmail,
      firstName,
      otpCode,
      subject,
      textContent,
      provider: `Brevo SMTP (${envVariables.SMTP_HOST || "smtp-relay.brevo.com"})`,
      error,
    });
    return false;
  }
};

/**
 * Sends a 6-digit verification OTP code to user's NEW email address
 * to confirm ownership of the new email.
 */
const sendNewEmailVerificationOtpEmail = async (toEmail, otpCode, firstName = "User") => {
  const from = getFromAddress();
  const subject = `${otpCode} is your verification code for your new Food App email`;

  const textContent = `
Hello ${firstName},

You requested to set ${toEmail} as your new primary email address for Food App.
Your 6-Digit New Email Verification Code (OTP) is: ${otpCode}

This code will expire in 10 minutes. Please enter this code in the app to verify ownership of this new email address.
`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
    </head>
    <body style="margin: 0; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
      <div style="max-width: 520px; margin: 0 auto; background-color: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <div style="background-color: #10b981; padding: 24px; text-align: center;">
          <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700; letter-spacing: -0.5px;">Food App</h1>
          <p style="margin: 6px 0 0; color: #d1fae5; font-size: 14px;">Confirm New Email Address</p>
        </div>

        <div style="padding: 28px;">
          <p style="font-size: 16px; margin-top: 0;">Hello <strong>${firstName}</strong>,</p>
          <p style="font-size: 14px; line-height: 1.6; color: #475569;">
            You requested to set this email as your new primary Food App account email. Please enter this <strong>New Email Verification OTP</strong> in the app:
          </p>

          <div style="text-align: center; margin: 24px 0;">
            <div style="display: inline-block; background-color: #f0fdf4; border: 2px dashed #10b981; border-radius: 10px; padding: 14px 32px;">
              <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #047857; font-family: monospace;">${otpCode}</span>
            </div>
            <p style="font-size: 13px; color: #64748b; margin-top: 10px;">Valid for <strong>10 minutes</strong></p>
          </div>

          <div style="background-color: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; border-radius: 6px; margin: 20px 0;">
            <p style="margin: 0; font-size: 13px; color: #1e40af; line-height: 1.5;">
              <strong>Note:</strong> You will also need to enter the code sent to your old email address to finalize this update.
            </p>
          </div>
        </div>

        <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px; text-align: center;">
          <p style="margin: 0; font-size: 12px; color: #94a3b8;">&copy; ${new Date().getFullYear()} Food App. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    const transporter = getTransporter();
    const result = await transporter.sendMail({
      from,
      to: toEmail,
      subject,
      text: textContent,
      html: htmlContent,
    });

    printEmailLog({
      title: "New Email Verification OTP",
      from,
      toEmail,
      firstName,
      otpCode,
      subject,
      textContent,
      provider: `Brevo SMTP (${envVariables.SMTP_HOST || "smtp-relay.brevo.com"})`,
      result,
    });

    return true;
  } catch (error) {
    printEmailLog({
      title: "New Email Verification OTP",
      from,
      toEmail,
      firstName,
      otpCode,
      subject,
      textContent,
      provider: `Brevo SMTP (${envVariables.SMTP_HOST || "smtp-relay.brevo.com"})`,
      error,
    });
    return false;
  }
};

module.exports = {
  sendPasswordResetEmail,
  sendOtpEmail,
  sendProfileUpdateOtpEmail,
  sendOldEmailChangeOtpEmail,
  sendNewEmailVerificationOtpEmail,
};


