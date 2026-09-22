const axios = require('axios');
const rateLimiter = require('./rateLimiterService');

const HIGH_RISK_INTENTS = ['refund_request', 'cancel_order', 'address_change'];

const checkResponseConfidence = async (orderData, generatedResponse, threshold = 50, intent = null) => {
    const isHighRisk = HIGH_RISK_INTENTS.includes(intent);
    try {
        console.log(`[Confidence] START - Checking confidence for response: "${generatedResponse ? generatedResponse.substring(0, 100) : ''}..." (Intent: ${intent || 'N/A'}, HighRisk: ${isHighRisk})`);

        // Validate inputs
        if (!generatedResponse || generatedResponse.trim().length === 0) {
            console.error('[Confidence] ERROR: Empty response provided');
            return { confidence_score: 0, reason: 'Empty response', should_escalate: true };
        }

        if (!orderData || typeof orderData !== 'object') {
            console.error('[Confidence] ERROR: Invalid order data provided');
            return { confidence_score: 0, reason: 'Invalid order data', should_escalate: true };
        }

        // Check if rateLimiter global cooldown is active
        if (rateLimiter.isGlobalCooldown()) {
            if (isHighRisk) {
                console.warn(`[Confidence] Global cooldown active on high-risk intent "${intent}" - FAILING CLOSED`);
                return {
                    confidence_score: 0,
                    reason: `Global rate limit cooldown active on high-risk intent (${intent}) - escalated for safety`,
                    should_escalate: true
                };
            }
            console.warn(`[Confidence] Global rate limit cooldown active on low-risk intent "${intent}" - failing open`);
            return { confidence_score: 65, reason: 'Global rate limit cooldown active - skipped', should_escalate: false };
        }

        const PRIMARY_MODEL = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
        const FALLBACK_MODEL = PRIMARY_MODEL === 'gemini-1.5-flash' ? 'gemini-2.0-flash' : 'gemini-1.5-flash';

        const requestPayload = {
            contents: [{
                parts: [{
                    text: `You are evaluating the quality of a customer support response.
Given the order data and the generated response, rate on a scale of 0-100 how well the response is supported by the actual order data.
The response should be accurate and not make up information.

Order Data:
${JSON.stringify(orderData, null, 2)}

Customer Support Response:
"${generatedResponse}"

Respond ONLY with valid JSON (no markdown, no code blocks):
{"confidence_score": <number 0-100>, "reason": "<brief explanation>"}`
                }]
            }]
        };

        const postToGemini = (modelName) => {
            return axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${process.env.GEMINI_API_KEY}`,
                requestPayload,
                { timeout: 4000 }
            );
        };

        let apiResponse;
        try {
            console.log(`[Confidence] Calling Gemini API (${PRIMARY_MODEL}) to rate response quality...`);
            apiResponse = await postToGemini(PRIMARY_MODEL);
        } catch (modelError) {
            if (modelError.response?.status === 404) {
                console.warn(`[Confidence] Gemini model "${PRIMARY_MODEL}" returned 404. Retrying with fallback model "${FALLBACK_MODEL}"...`);
                apiResponse = await postToGemini(FALLBACK_MODEL);
            } else {
                throw modelError;
            }
        }

        // Validate API response structure
        if (!apiResponse.data || !apiResponse.data.candidates || apiResponse.data.candidates.length === 0) {
            console.error('[Confidence] ERROR: Invalid Gemini API response structure');
            console.error('[Confidence] Response:', JSON.stringify(apiResponse.data).substring(0, 200));
            if (isHighRisk) {
                return { confidence_score: 0, reason: 'Invalid API response structure on high-risk intent', should_escalate: true };
            }
            return { confidence_score: 65, reason: 'Default confidence', should_escalate: false };
        }

        const candidate = apiResponse.data.candidates[0];
        if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
            console.error('[Confidence] ERROR: No content in API response');
            if (isHighRisk) {
                return { confidence_score: 0, reason: 'No content in API response on high-risk intent', should_escalate: true };
            }
            return { confidence_score: 65, reason: 'Default confidence', should_escalate: false };
        }

        const text = candidate.content.parts[0].text;
        console.log(`[Confidence] Raw API response text: "${text}"`);

        // Clean the response - remove markdown code blocks and extra whitespace
        const cleaned = text
            .replace(/```json\n?/g, '')
            .replace(/```\n?/g, '')
            .replace(/^```/g, '')
            .replace(/```$/g, '')
            .trim();

        console.log(`[Confidence] Cleaned response: "${cleaned}"`);

        // Parse JSON with better error handling
        let result;
        try {
            result = JSON.parse(cleaned);
        } catch (parseError) {
            console.error(`[Confidence] JSON Parse Error: ${parseError.message}`);
            console.error(`[Confidence] Failed to parse: "${cleaned.substring(0, 200)}"`);

            // Try to extract confidence number from the text if JSON parsing fails
            const numberMatch = cleaned.match(/["']?confidence_score["']?\s*:\s*(\d+)/i);
            if (numberMatch && numberMatch[1]) {
                const extractedScore = parseInt(numberMatch[1], 10);
                console.log(`[Confidence] Extracted score from malformed JSON: ${extractedScore}`);
                result = {
                    confidence_score: Math.min(100, Math.max(0, extractedScore)),
                    reason: 'Extracted from response'
                };
            } else {
                throw parseError;
            }
        }

        // Validate the parsed result
        if (!result || typeof result !== 'object') {
            console.error('[Confidence] ERROR: Parsed result is not an object');
            if (isHighRisk) {
                return { confidence_score: 0, reason: 'Parsed result not an object on high-risk intent', should_escalate: true };
            }
            return { confidence_score: 65, reason: 'Default confidence', should_escalate: false };
        }

        // Validate confidence_score exists and is a number
        if (result.confidence_score === undefined || result.confidence_score === null) {
            console.error('[Confidence] ERROR: confidence_score missing from result');
            console.error('[Confidence] Result:', JSON.stringify(result));
            if (isHighRisk) {
                return { confidence_score: 0, reason: 'Score missing from response on high-risk intent', should_escalate: true };
            }
            return { confidence_score: 65, reason: 'Score missing from response', should_escalate: false };
        }

        const confidenceScore = parseInt(result.confidence_score, 10);
        if (isNaN(confidenceScore)) {
            console.error(`[Confidence] ERROR: confidence_score is NaN: "${result.confidence_score}"`);
            if (isHighRisk) {
                return { confidence_score: 0, reason: 'Invalid score value on high-risk intent', should_escalate: true };
            }
            return { confidence_score: 65, reason: 'Invalid score value', should_escalate: false };
        }

        // Ensure score is between 0 and 100
        const validatedScore = Math.min(100, Math.max(0, confidenceScore));
        if (validatedScore !== confidenceScore) {
            console.warn(`[Confidence] Score was outside 0-100 range: ${confidenceScore}, clamped to ${validatedScore}`);
        }

        console.log(`[Confidence] SUCCESS - Confidence score: ${validatedScore}%, Reason: ${result.reason}`);

        return {
            confidence_score: validatedScore,
            reason: result.reason || 'Quality check completed',
            should_escalate: validatedScore < threshold  // Escalate if confidence below threshold
        };

    } catch (error) {
        const geminiDetails = error.response?.data?.error?.message || error.message;
        console.error(`[Confidence] EXCEPTION: ${error.message} (Details: ${geminiDetails})`);
        console.error(`[Confidence] Error type: ${error.code || error.name}`);

        if (error.response?.status === 401) {
            console.error('[Confidence] CRITICAL: Gemini API authentication failed - check GEMINI_API_KEY');
        } else if (error.response?.status === 429) {
            console.error('[Confidence] Rate limited by Gemini API - implement exponential backoff');
        } else if (error.response?.status === 404) {
            console.error(`[Confidence] Gemini API model not found (404): ${geminiDetails}`);
        } else if (error.message.includes('timeout')) {
            console.error('[Confidence] Confidence check timed out - API may be slow');
        }

        console.error('[Confidence] Full error:', error.message);

        // High-risk intents (refunds, cancellations, address changes): FAIL-CLOSED
        if (isHighRisk) {
            console.warn(`[Confidence] Guardrail check failed on high-risk intent "${intent}" — FAILING CLOSED`);
            return {
                confidence_score: 0,
                reason: `Confidence check failed/timed out on high-risk intent (${intent}): ${error.message}`,
                should_escalate: true
            };
        }

        // Low-risk intents (order_status, shipping_status, etc.): FAIL-OPEN
        return {
            confidence_score: 65,
            reason: `Unable to calculate confidence on low-risk intent: ${error.message}`,
            should_escalate: false
        };
    }
};

module.exports = { checkResponseConfidence, HIGH_RISK_INTENTS };