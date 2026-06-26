const nodemailer = require('nodemailer');

const createTransporter = () => {
    // Return a dummy object since we are mocking email sending
    return {
        sendMail: async (options) => {
            console.log(`[Email] [MOCKED sendMail] Direct call to dummy transporter`);
            return { messageId: `dummy-id-${Date.now()}` };
        }
    };
};

const sendEmail = async (to, subject, html) => {
    try {
        console.log('=================== [MOCKED EMAIL OUTBOX] ===================');
        console.log(`To:      ${to}`);
        console.log(`Subject: ${subject}`);
        console.log('Body:');
        console.log(html);
        console.log('============================================================');
        
        return { success: true, messageId: `mocked-smtp-${Date.now()}` };
    } catch (error) {
        console.error(`[Email] Failed to process mocked email to ${to}: ${error.message}`);
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

module.exports = {
    sendEmail,
    sendEscalationAlert
};
