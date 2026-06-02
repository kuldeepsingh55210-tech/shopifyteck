const db = require('../db/db');

const generateFallbackResponse = (orderData, customerMessage, intent = 'order_status') => {
  const orderId = orderData && orderData.id ? orderData.id : (orderData && orderData.order_number ? orderData.order_number : 'Unknown');
  const status = orderData && orderData.fulfillment_status ? orderData.fulfillment_status : 'processing';
  
  let orderAgeDays = 0;
  if (orderData && orderData.created_at) {
    orderAgeDays = Math.ceil(Math.abs(new Date() - new Date(orderData.created_at)) / (1000 * 60 * 60 * 24));
  }

  // Handle intents based on the user specification
  if (intent === 'order_status' || intent === 'shipping_status') {
    return `Your order #${orderId} is currently ${status}. Expected delivery: soon.`;
  }

  if (intent === 'refund_request') {
    if (orderData && orderData.financial_status === 'paid' && orderAgeDays <= 30) {
      return `We have received your refund request for order #${orderId}. Our team will review it and get back to you within 24 hours.`;
    } else {
      return `We're sorry, order #${orderId} is not eligible for refund as it was placed ${orderAgeDays} days ago or its status doesn't permit it.`;
    }
  }

  if (intent === 'cancel_order') {
    if (orderData && orderData.fulfillment_status === 'fulfilled') {
      return `We're sorry, order #${orderId} has already been shipped and cannot be cancelled.`;
    } else {
      return `We have received your cancellation request for order #${orderId}. Our team will process it and confirm shortly.`;
    }
  }

  if (intent === 'angry_customer') {
    return `We sincerely apologize for the inconvenience. A senior support agent will contact you within 2 hours.`;
  }

  if (intent === 'human_handoff') {
    return `Connecting you to our support team. Expected wait time: 5-10 minutes.`;
  }

  if (intent === 'cod_verification') {
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
