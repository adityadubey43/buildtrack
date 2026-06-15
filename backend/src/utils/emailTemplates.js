const APP_NAME = "BuildTrack";
const BRAND_COLOR = "#f97316"; // orange-500
const FE = () => process.env.FRONTEND_URL || "https://buildtrack.in";

function base(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 0;">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);max-width:600px;width:100%;">
      <!-- Header -->
      <tr>
        <td style="background:${BRAND_COLOR};padding:28px 40px;text-align:center;">
          <span style="color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.5px;">🏗 ${APP_NAME}</span>
        </td>
      </tr>
      <!-- Body -->
      <tr>
        <td style="padding:36px 40px 28px;">
          ${bodyHtml}
        </td>
      </tr>
      <!-- Footer -->
      <tr>
        <td style="background:#f1f5f9;padding:20px 40px;text-align:center;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">
            © ${new Date().getFullYear()} ${APP_NAME} · Construction Management Platform<br/>
            <a href="${FE()}" style="color:${BRAND_COLOR};text-decoration:none;">${FE()}</a>
          </p>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function btn(text, url) {
  return `<a href="${url}" style="display:inline-block;background:${BRAND_COLOR};color:#ffffff;text-decoration:none;padding:13px 32px;border-radius:10px;font-weight:600;font-size:15px;margin:20px 0;">${text}</a>`;
}

function h1(text) {
  return `<h1 style="margin:0 0 8px;color:#0f172a;font-size:24px;font-weight:700;">${text}</h1>`;
}

function p(text) {
  return `<p style="margin:12px 0;color:#475569;font-size:15px;line-height:1.6;">${text}</p>`;
}

function infoBox(rows) {
  const cells = rows.map(([label, value]) =>
    `<tr>
      <td style="padding:10px 16px;color:#64748b;font-size:13px;font-weight:600;width:40%;border-bottom:1px solid #f1f5f9;">${label}</td>
      <td style="padding:10px 16px;color:#0f172a;font-size:14px;font-weight:500;border-bottom:1px solid #f1f5f9;">${value}</td>
    </tr>`
  ).join("");
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:10px;overflow:hidden;margin:20px 0;border:1px solid #e2e8f0;">${cells}</table>`;
}

// ── Templates ────────────────────────────────────────────────────────────────

/**
 * 1. Welcome / account created (free-trial signup via /api/auth/signup)
 */
function welcome({ adminName, companyName, email, plan, trialEndsAt, loginUrl }) {
  const trialDate = new Date(trialEndsAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  return {
    subject: `Welcome to ${APP_NAME}, ${adminName}! 🎉`,
    html: base(`Welcome to ${APP_NAME}`, `
      ${h1(`Welcome aboard, ${adminName}!`)}
      ${p(`Your <strong>${companyName}</strong> account has been created on ${APP_NAME}. You're all set to manage your construction projects in one place.`)}
      ${infoBox([
        ["Account Name", companyName],
        ["Login Email", email],
        ["Plan", plan.charAt(0).toUpperCase() + plan.slice(1)],
        ["Trial Ends", trialDate],
      ])}
      ${p("During your free trial you have full access to all features. Upgrade anytime before your trial ends to keep your data.")}
      <div style="text-align:center;">${btn("Go to Dashboard", loginUrl || FE())}</div>
      ${p(`If you have any questions, just reply to this email — we're happy to help.`)}
    `),
  };
}

/**
 * 2. Forgot password — reset link
 */
function forgotPassword({ name, resetUrl }) {
  return {
    subject: `Reset your ${APP_NAME} password`,
    html: base("Reset Password", `
      ${h1("Forgot your password?")}
      ${p(`Hi ${name}, no worries — it happens! Click the button below to set a new password. This link is valid for <strong>1 hour</strong>.`)}
      <div style="text-align:center;">${btn("Reset Password", resetUrl)}</div>
      ${p(`If you didn't request a password reset, you can safely ignore this email. Your password will not change.`)}
      <p style="margin:16px 0 0;color:#94a3b8;font-size:12px;">If the button doesn't work, copy and paste this link into your browser:<br/>
      <a href="${resetUrl}" style="color:${BRAND_COLOR};word-break:break-all;">${resetUrl}</a></p>
    `),
  };
}

/**
 * 3. Password reset confirmation
 */
function passwordChanged({ name }) {
  return {
    subject: `Your ${APP_NAME} password was changed`,
    html: base("Password Changed", `
      ${h1("Password changed successfully")}
      ${p(`Hi ${name}, your ${APP_NAME} password was just changed.`)}
      ${p(`If you made this change, you're all set — log in with your new password.`)}
      ${p(`<strong>If you did NOT make this change</strong>, please contact us immediately by replying to this email.`)}
      <div style="text-align:center;">${btn("Log In Now", `${FE()}/login`)}</div>
    `),
  };
}

/**
 * 4. Team member added (sent to the new user)
 */
function teamMemberAdded({ memberName, companyName, role, email, loginUrl }) {
  return {
    subject: `You've been added to ${companyName} on ${APP_NAME}`,
    html: base("Team Invitation", `
      ${h1(`You're now part of ${companyName}!`)}
      ${p(`Hi ${memberName}, you've been added to <strong>${companyName}</strong>'s workspace on ${APP_NAME}.`)}
      ${infoBox([
        ["Company", companyName],
        ["Your Email", email],
        ["Your Role", role.charAt(0).toUpperCase() + role.slice(1)],
      ])}
      ${p("Log in with your email address to get started. If this is your first time, use the email above.")}
      <div style="text-align:center;">${btn("Log In to ${APP_NAME}", loginUrl || FE())}</div>
    `),
  };
}

/**
 * 5. Payment / subscription confirmed (new signup with payment)
 */
function paymentConfirmed({ adminName, companyName, plan, billing, amount, startDate, nextBillingDate, paymentId }) {
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—";
  const fmtAmt = (n) => n ? `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—";
  return {
    subject: `Payment confirmed — ${APP_NAME} ${plan} plan`,
    html: base("Payment Confirmed", `
      ${h1("Payment confirmed ✅")}
      ${p(`Hi ${adminName}, thank you for subscribing to ${APP_NAME}! Your payment has been received and your account is now active.`)}
      ${infoBox([
        ["Company", companyName],
        ["Plan", plan.charAt(0).toUpperCase() + plan.slice(1)],
        ["Billing", billing === "yearly" ? "Yearly" : "Monthly"],
        ["Amount Paid", fmtAmt(amount)],
        ["Start Date", fmtDate(startDate)],
        ["Next Billing", billing === "yearly" ? fmtDate(nextBillingDate) : "Auto-renews monthly"],
        ["Payment ID", paymentId || "—"],
      ])}
      ${p("You now have full access to all features. Keep this email as your payment receipt.")}
      <div style="text-align:center;">${btn("Go to Dashboard", FE())}</div>
    `),
  };
}

/**
 * 6. Subscription renewed (recurring monthly charge via webhook)
 */
function subscriptionRenewed({ companyName, plan, amount, billing, periodEnd }) {
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" }) : "—";
  const fmtAmt = (n) => n ? `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : "—";
  return {
    subject: `${APP_NAME} subscription renewed`,
    html: base("Subscription Renewed", `
      ${h1("Subscription renewed ✅")}
      ${p(`Your ${APP_NAME} subscription for <strong>${companyName}</strong> has been successfully renewed.`)}
      ${infoBox([
        ["Plan", plan.charAt(0).toUpperCase() + plan.slice(1)],
        ["Amount Charged", fmtAmt(amount)],
        ["Billing", billing === "yearly" ? "Yearly" : "Monthly"],
        ["Valid Until", fmtDate(periodEnd)],
      ])}
      ${p("No action needed — your service continues uninterrupted.")}
      <div style="text-align:center;">${btn("Go to Dashboard", FE())}</div>
    `),
  };
}

/**
 * 7. Trial ending soon (3 days before)
 */
function trialEndingSoon({ adminName, companyName, trialEndsAt, upgradeUrl }) {
  const trialDate = new Date(trialEndsAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  return {
    subject: `⏰ Your ${APP_NAME} trial ends on ${trialDate}`,
    html: base("Trial Ending Soon", `
      ${h1("Your free trial is ending soon")}
      ${p(`Hi ${adminName}, your free trial for <strong>${companyName}</strong> on ${APP_NAME} ends on <strong>${trialDate}</strong>.`)}
      ${p("After the trial ends, you will lose access to your dashboard, projects, and all data until you upgrade.")}
      ${p("Upgrade now to keep everything and continue managing your projects without interruption.")}
      <div style="text-align:center;">${btn("Upgrade Now", upgradeUrl || FE())}</div>
      ${p("If you have any questions about plans or pricing, just reply to this email.")}
    `),
  };
}

/**
 * 8. Trial expired / plan expired
 */
function planExpired({ adminName, companyName, upgradeUrl }) {
  return {
    subject: `Your ${APP_NAME} access has expired`,
    html: base("Access Expired", `
      ${h1("Your access has expired")}
      ${p(`Hi ${adminName}, your ${APP_NAME} access for <strong>${companyName}</strong> has expired.`)}
      ${p("Your data is safe — we keep it for 30 days. Upgrade to reactivate your account and pick up right where you left off.")}
      <div style="text-align:center;">${btn("Reactivate Account", upgradeUrl || FE())}</div>
      ${p("Need help? Just reply to this email and we'll sort it out.")}
    `),
  };
}

/**
 * 9. Subscription cancelled
 */
function subscriptionCancelled({ adminName, companyName }) {
  return {
    subject: `${APP_NAME} subscription cancelled`,
    html: base("Subscription Cancelled", `
      ${h1("Subscription cancelled")}
      ${p(`Hi ${adminName}, your ${APP_NAME} subscription for <strong>${companyName}</strong> has been cancelled.`)}
      ${p("You will continue to have access until the end of your current billing period.")}
      ${p("Your data is retained for 30 days after access ends. If you change your mind, you can reactivate anytime.")}
      <div style="text-align:center;">${btn("Reactivate", FE())}</div>
      ${p("We're sorry to see you go. If there's anything we could have done better, please let us know.")}
    `),
  };
}

module.exports = {
  welcome,
  forgotPassword,
  passwordChanged,
  teamMemberAdded,
  paymentConfirmed,
  subscriptionRenewed,
  trialEndingSoon,
  planExpired,
  subscriptionCancelled,
};
