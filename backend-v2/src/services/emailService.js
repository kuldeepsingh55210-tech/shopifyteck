const nodemailer = require('nodemailer');

const createTransporter = () => {
    return nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
        port: process.env.SMTP_PORT || 2525,
        secure: false,
        auth: {
            user: process.env.SMTP_USER || 'user',
            pass: process.env.SMTP_PASS || 'pass',
        },
    });
};

const sendEmail = async (to, subject, html) => {
    try {
        const transporter = createTransporter();
        const info = await transporter.sendMail({
            from: '"AutoSupport AI" <noreply@autosupport.ai>',
            to,
            subject,
            html,
        });
        console.log(`[Email] Sent notification to ${to}: ${info.messageId}`);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error(`[Email] Failed to send email to ${to}: ${error.message}`);
        return { success: false, error: error.message };
    }
};

const sendEscalationAlert = async (merchantEmail, customerEmail, reason, priority) => {
    console.log(`[Email] Sending escalation alert to ${merchantEmail}`);

    if (!process.env.SMTP_HOST || !process.env.SMTP_PORT || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
        console.log('[Email] SMTP not configured, skipping actual delivery and returning success');
        return { success: true, skipped: true };
    }

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

module.exports = {
    sendEmail,
    sendEscalationAlert
};
