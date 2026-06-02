const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('../db/db');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
let extensionVerified = false;

const markExtensionVerified = () => {
    if (!extensionVerified) {
        extensionVerified = true;
        console.log('[RAG] Extension loaded successfully');
    }
};

const generateEmbedding = async (text) => {
    try {
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
            console.warn('[RAG] Empty text provided for embedding generation');
            return null;
        }
        console.log('[RAG] Generating embedding for:', text.substring(0, 50));
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${process.env.GEMINI_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    content: { parts: [{ text: text }] }
                })
            }
        );
        const data = await response.json();
        if (data.embedding && data.embedding.values) {
            console.log('[RAG] Embedding generated:', data.embedding.values.length, 'dims');
            return data.embedding.values;
        }
        return null;
    } catch (error) {
        console.log('[RAG] Embedding generation failed:', error.message);
        return null;
    }
};

const addKnowledgeEntry = async (shopDomain, category, question, answer) => {
    try {
        const result = await db.query(
            `INSERT INTO merchant_knowledge_base (shop_domain, category, question, answer) VALUES ($1, $2, $3, $4) RETURNING id`,
            [shopDomain, category || 'General', question, answer]
        );
        markExtensionVerified();
        return { success: true, id: result.rows[0].id };
    } catch (error) {
        console.error('[RAG] Failed to add knowledge entry:', error?.message || error);
        return { success: false, error: error?.message || 'Failed to add knowledge entry' };
    }
};

const searchKnowledge = async (shopDomain, query, limit = 3) => {
    try {
        const result = await db.query(
            `SELECT question, answer, category
             FROM merchant_knowledge_base
             WHERE shop_domain = $1 
             AND is_active = true
             AND (
                 question ILIKE $2 OR 
                 answer ILIKE $2 OR
                 to_tsvector('english', question || ' ' || answer) @@ 
                 plainto_tsquery('english', $3)
             )
             LIMIT $4`,
            [shopDomain, `%${query}%`, query, limit]
        );
        return result.rows;
    } catch (error) {
        console.log('[RAG] Search error:', error.message);
        return [];
    }
};

const buildRAGContext = async (shopDomain, customerMessage) => {
    console.log('[RAG] buildRAGContext called for:', shopDomain);
    try {
        console.log(`[RAG] Searching knowledge for: ${customerMessage}`);
        const results = await searchKnowledge(shopDomain, customerMessage, 3);
        if (!results || results.length === 0) {
            console.log('[RAG] No relevant knowledge base entries found');
            return '';
        }

        console.log(`[RAG] Found ${results.length} relevant entries`);

        const entriesText = results.map((entry) =>
            `[Category: ${entry.category || 'General'}]
Q: ${entry.question}
A: ${entry.answer}`
        ).join('\n\n');

        return `MERCHANT KNOWLEDGE BASE:
The following information is from this merchant's actual store policies and FAQs.
Use this information to answer accurately.
DO NOT make up any information not listed here.

${entriesText}

IMPORTANT: If customer asks about refund/return/shipping, use ONLY the above merchant-specific information.`;
    } catch (error) {
        console.error('[RAG] Failed to build RAG context:', error?.message || error);
        return '';
    }
};

const deleteKnowledgeEntry = async (shopDomain, id) => {
    try {
        const result = await db.query(
            `UPDATE merchant_knowledge_base SET is_active = false WHERE shop_domain = $1 AND id = $2`,
            [shopDomain, id]
        );
        return { success: result.rowCount > 0 };
    } catch (error) {
        console.error('[RAG] Failed to delete knowledge entry:', error?.message || error);
        return { success: false, error: error?.message || 'Failed to delete knowledge entry' };
    }
};

const getKnowledgeBase = async (shopDomain) => {
    try {
        const result = await db.query(
            `SELECT id, category, question, answer, created_at
             FROM merchant_knowledge_base
             WHERE shop_domain = $1 AND is_active = true
             ORDER BY category, created_at`,
            [shopDomain]
        );
        return result.rows;
    } catch (error) {
        console.error('[RAG] Failed to fetch knowledge base:', error?.message || error);
        return [];
    }
};

module.exports = {
    generateEmbedding,
    addKnowledgeEntry,
    searchKnowledge,
    buildRAGContext,
    deleteKnowledgeEntry,
    getKnowledgeBase
};