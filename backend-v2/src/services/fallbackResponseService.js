const db = require('../db/db');

const generateFallbackResponse = (orderData, customerMessage, intent = 'order_status', language = 'english') => {
  // Handle intents based on the user specification
  if (intent === 'greeting') {
    return "Hi! Welcome to our support. How can I help you today? 😊";
  }

  if (intent === 'order_status' || intent === 'shipping_status' || intent === 'delivery_issue') {
    return "Please share your order number and I'll check the status right away!";
  }

  if (intent === 'refund_request') {
    return "I'd be happy to help with your refund. Please share your order number.";
  }

  if (intent === 'cancel_order') {
    return "To cancel your order, please share your order number.";
  }

  if (intent === 'payment_issue') {
    return "Your payment concern is noted. Please share your order number so I can help.";
  }

  if (intent === 'wrong_item') {
    return "I'm sorry about the wrong item! Please share your order number and a photo.";
  }

  if (intent === 'discount_issue') {
    return "Please share the coupon code you're trying to use and I'll check it for you.";
  }

  if (intent === 'size_query') {
    return "I'd love to help with sizing! What product are you looking at?";
  }

  if (intent === 'general_inquiry') {
    return "I'm here to help! What would you like to know?";
  }

  if (intent === 'unknown' || intent === 'random') {
    return "I didn't quite understand that. Could you describe your issue?";
  }

  if (intent === 'angry_customer') {
    return "I sincerely apologize for the inconvenience. A human agent will assist you shortly.";
  }

  // Handle other intents we had previously
  if (intent === 'exchange_request') {
    return "We'd be happy to help you exchange your item! For orders placed within 30 days, we offer free exchanges. Please provide more details about the issue (size, defect, etc.) and we'll process it right away.";
  }

  if (intent === 'human_handoff') {
    return "Connecting you to our support team. Expected wait time: 5-10 minutes.";
  }

  if (intent === 'cod_verification') {
    const orderId = orderData && orderData.id ? orderData.id : (orderData && orderData.order_number ? orderData.order_number : 'Unknown');
    const amount = orderData && orderData.total_price ? orderData.total_price : 'the total amount';
    return `Your COD order #${orderId} is confirmed. Please keep ${amount} ready at the time of delivery.`;
  }

  // Generic fallback for any other intents
  return "Thank you for contacting us! We're currently experiencing high demand. Please contact our support team for assistance.";
};

const getCannedResponse = async (shopDomain, intent) => {
  try {
    const result = await db.query(
      `SELECT id, message FROM canned_responses 
       WHERE shop_domain = $1 
       AND intent = $2 
       AND is_active = true 
       ORDER BY usage_count DESC LIMIT 1`,
      [shopDomain, intent]
    );

    if (result.rows.length > 0) {
      const { id, message } = result.rows[0];

      // Increment usage count
      await db.query(
        'UPDATE canned_responses SET usage_count = usage_count + 1 WHERE id = $1',
        [id]
      );

      console.log(`[Canned] Response found for intent: ${intent}`);
      console.log(`[Canned] Usage count updated for id: ${id}`);
      return message;
    }

    console.log(`[Canned] No canned response for: ${intent}`);
    return null;
  } catch (error) {
    console.error('Error fetching canned response:', error.message);
    return null;
  }
};

module.exports = { generateFallbackResponse, getCannedResponse };
