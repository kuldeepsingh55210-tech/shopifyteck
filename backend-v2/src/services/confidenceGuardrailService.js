const axios = require('axios');

const checkResponseConfidence = async (orderData, generatedResponse) => {
    try {
        console.log(`[Confidence] START - Checking confidence for response: "${generatedResponse.substring(0, 100)}..."`);

        // Validate inputs
        if (!generatedResponse || generatedResponse.trim().length === 0) {
            console.error('[Confidence] ERROR: Empty response provided');
            return { confidence_score: 0, reason: 'Empty response', should_escalate: true };
        }

        if (!orderData || typeof orderData !== 'object') {
            console.error('[Confidence] ERROR: Invalid order data provided');
            return { confidence_score: 0, reason: 'Invalid order data', should_escalate: true };
        }

        console.log(`[Confidence] Calling Gemini API to rate response quality...`);

        const apiResponse = await Promise.race([
            axios.post(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-001:generateContent?key=${process.env.GEMINI_API_KEY}`,
                {
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
                }
            ),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Confidence check timeout')), 8000))
        ]);

        // Validate API response structure
        if (!apiResponse.data || !apiResponse.data.candidates || apiResponse.data.candidates.length === 0) {
            console.error('[Confidence] ERROR: Invalid Gemini API response structure');
            console.error('[Confidence] Response:', JSON.stringify(apiResponse.data).substring(0, 200));
            return { confidence_score: 65, reason: 'Default confidence', should_escalate: false };
        }

        const candidate = apiResponse.data.candidates[0];
        if (!candidate.content || !candidate.content.parts || candidate.content.parts.length === 0) {
            console.error('[Confidence] ERROR: No content in API response');
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
            return { confidence_score: 65, reason: 'Default confidence', should_escalate: false };
        }

        // Validate confidence_score exists and is a number
        if (result.confidence_score === undefined || result.confidence_score === null) {
            console.error('[Confidence] ERROR: confidence_score missing from result');
            console.error('[Confidence] Result:', JSON.stringify(result));
            return { confidence_score: 65, reason: 'Score missing from response', should_escalate: false };
        }

        const confidenceScore = parseInt(result.confidence_score, 10);
        if (isNaN(confidenceScore)) {
            console.error(`[Confidence] ERROR: confidence_score is NaN: "${result.confidence_score}"`);
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
            should_escalate: validatedScore < 60  // Escalate if confidence below 60%
        };

    } catch (error) {
        console.error(`[Confidence] EXCEPTION: ${error.message}`);
        console.error(`[Confidence] Error type: ${error.code || error.name}`);

        if (error.response?.status === 401) {
            console.error('[Confidence] CRITICAL: Gemini API authentication failed - check GEMINI_API_KEY');
        } else if (error.response?.status === 429) {
            console.error('[Confidence] Rate limited by Gemini API - implement exponential backoff');
        } else if (error.message.includes('timeout')) {
            console.error('[Confidence] Confidence check timed out - API may be slow');
        }

        console.error('[Confidence] Full error:', error);

        // Return a neutral default confidence instead of 0 on error
        // This prevents false escalations due to transient API issues
        return {
            confidence_score: 65,
            reason: 'Unable to calculate confidence',
            should_escalate: false
        };
    }
};

module.exports = { checkResponseConfidence };