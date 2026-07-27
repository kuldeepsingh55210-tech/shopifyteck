const nodemailer = require('nodemailer');

const isSmtpConfigured = () => {
    return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
};

let cachedTransporter = null;
const createTransporter = () => {
    if (!isSmtpConfigured()) {
        return {
            sendMail: async (options) => {
                console.log(`[Email] [MOCKED sendMail] SMTP not configured - would have sent to ${options.to}`);
                return { messageId: `mocked-${Date.now()}` };
            }
        };
    }

    if (!cachedTransporter) {
        cachedTransporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT) || 465,
            secure: Number(process.env.SMTP_PORT) === 587 ? false : true,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    }
    return cachedTransporter;
};

const sendEmail = async (to, subject, html) => {
    try {
        if (!isSmtpConfigured()) {
            console.warn('=================== [SMTP NOT CONFIGURED - EMAIL NOT SENT] ===================');
            console.warn(`To:      ${to}`);
            console.warn(`Subject: ${subject}`);
            console.warn('Body:');
            console.warn(html);
            console.warn('Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM in .env to send real emails.');
            console.warn('================================================================================');
            return { success: true, messageId: `mocked-smtp-${Date.now()}`, mocked: true };
        }

        const transporter = createTransporter();
        const info = await transporter.sendMail({
            from: process.env.SMTP_FROM || process.env.SMTP_USER,
            to,
            subject,
            html
        });

        console.log(`[Email] Sent to ${to}, messageId: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error(`[Email] Failed to send email to ${to}: ${error.message}`);
        return { success: false, error: error.message };
    }
};

const sendEscalationAlert = async (merchantEmail, customerEmail, reason, priority) => {
    console.log(`[Email] Triggering escalation alert to ${merchantEmail} (mocked)`);

    const timestamp = new Date().toISOString();
    const subject = '⚠️ New Escalated Ticket - AutoSupport AI';
    const body = `A customer needs immediate attention.<br/><br/>
      <strong>Customer:</strong> ${customerEmail}<br/>
      <strong>Reason:</strong> ${reason}<br/>
      <strong>Priority:</strong> ${priority}<br/>
      <strong>Time:</strong> ${timestamp}<br/><br/>
      Please login to your dashboard to respond.`;

    return sendEmail(merchantEmail, subject, body);
};

const sendRefundApprovalRequest = async (merchantEmail, details) => {
    const { customerEmail, orderNumber, amount, reason, approveUrl, rejectUrl } = details;
    console.log(`[Email] Triggering refund approval request to ${merchantEmail} (mocked)`);

    const subject = `Refund approval needed \u2014 Order ${orderNumber}`;
    const body = `A customer has requested a refund and it's ready for your review.<br/><br/>
      <strong>Customer:</strong> ${customerEmail}<br/>
      <strong>Order:</strong> ${orderNumber}<br/>
      <strong>Amount:</strong> ${amount || 'See order in Shopify admin'}<br/>
      <strong>Reason:</strong> ${reason}<br/><br/>
      <a href="${approveUrl}" style="background:#16a34a;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;margin-right:10px;display:inline-block;">Approve Refund</a>
      <a href="${rejectUrl}" style="background:#dc2626;color:#fff;padding:10px 20px;text-decoration:none;border-radius:6px;display:inline-block;">Reject</a><br/><br/>
      Each link can only be used once, and only one of them will take effect.`;

    return sendEmail(merchantEmail, subject, body);
};

module.exports = {
    sendEmail,
    sendEscalationAlert,
    sendRefundApprovalRequest
};
