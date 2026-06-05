// backend/services/emailService.js

const { Resend } = require('resend');
require('dotenv').config();

const resend = new Resend(process.env.RESEND_API_KEY);

const sendRenewalAlert = async (alert) => {
  const user = alert.users;
  const sub = alert.subscriptions;

  const daysUntil = Math.ceil(
    (new Date(sub.next_renewal_date) - new Date()) / (1000 * 60 * 60 * 24)
  );

  await resend.emails.send({
    from: 'alerts@subscriptiongraveyard.com',
    to: user.email,
    subject: `⏰ ${sub.service_name} charges ₹${sub.amount} in ${daysUntil} days`,
    html: `
      <!DOCTYPE html>
      <html>
      <body style="
        font-family: Arial, sans-serif;
        background: #f5f5f5;
        padding: 32px;
        margin: 0;
      ">
        <div style="
          max-width: 500px;
          margin: 0 auto;
          background: white;
          border-radius: 16px;
          padding: 32px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        ">
          <!-- Header -->
          <div style="
            background: #FF4455;
            color: white;
            padding: 20px;
            border-radius: 12px;
            margin-bottom: 24px;
            text-align: center;
          ">
            <p style="margin:0; font-size:12px; letter-spacing:2px; opacity:0.8;">
              RENEWAL ALERT
            </p>
            <h2 style="margin: 8px 0; font-size: 24px;">
              ${sub.service_name}
            </h2>
            <p style="margin: 0; font-size: 36px; font-weight: 900;">
              ₹${sub.amount}
            </p>
          </div>

          <!-- Info -->
          <p style="color: #333; font-size: 15px; line-height: 1.7;">
            Hi ${user.name},
          </p>
          <p style="color: #333; font-size: 15px; line-height: 1.7;">
            <strong>${sub.service_name}</strong> will automatically 
            charge you <strong>₹${sub.amount}</strong> on 
            <strong>${sub.next_renewal_date}</strong>.
          </p>
          <p style="color: #666; font-size: 13px;">
            Last receipt we found in Gmail: 
            ${sub.last_receipt_date || 'Not found'}
          </p>

          <!-- Buttons -->
          <a href="${sub.cancel_url || '#'}" style="
            display: block;
            background: #FF4455;
            color: white;
            text-decoration: none;
            padding: 14px;
            border-radius: 10px;
            text-align: center;
            font-weight: 700;
            font-size: 15px;
            margin-bottom: 10px;
          ">
            Cancel ${sub.service_name} →
          </a>

          <a href="${process.env.FRONTEND_URL}/dashboard" style="
            display: block;
            background: #f5f5f5;
            color: #333;
            text-decoration: none;
            padding: 14px;
            border-radius: 10px;
            text-align: center;
            font-size: 14px;
          ">
            View My Dashboard
          </a>

          <!-- Disclaimer -->
          <p style="
            color: #999;
            font-size: 11px;
            text-align: center;
            margin-top: 24px;
            line-height: 1.6;
          ">
            Subscription Graveyard — Know exactly what you pay for.<br>
            Cancel link opens official ${sub.service_name} settings page.<br>
            We never cancel subscriptions on your behalf.
          </p>
        </div>
      </body>
      </html>
    `
  });
};

module.exports = { sendRenewalAlert };