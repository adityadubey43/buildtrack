const nodemailer = require("nodemailer");

let _transporter = null;

function getTransporter() {
  if (_transporter) return _transporter;
  if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    console.warn("[mailer] EMAIL_HOST / EMAIL_USER / EMAIL_PASS not set — emails will be skipped.");
    return null;
  }
  _transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: Number(process.env.EMAIL_PORT) || 587,
    secure: Number(process.env.EMAIL_PORT) === 465,
    auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  });
  return _transporter;
}

/**
 * Send an email. Silently logs and skips if email is not configured.
 * @param {object} opts - { to, subject, html, text? }
 */
async function sendEmail({ to, subject, html, text }) {
  const transporter = getTransporter();
  if (!transporter) return;
  try {
    const from = process.env.EMAIL_FROM || `"BuildTrack" <${process.env.EMAIL_USER}>`;
    await transporter.sendMail({ from, to, subject, html, text });
    console.log(`[mailer] Sent "${subject}" → ${to}`);
  } catch (err) {
    console.error(`[mailer] Failed to send "${subject}" to ${to}:`, err.message);
  }
}

module.exports = { sendEmail };
