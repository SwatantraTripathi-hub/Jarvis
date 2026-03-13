// Import the Pinecone library
const{ Pinecone } = require( '@pinecone-database/pinecone')

const pineconeApiKey = process.env.Pine_Cone_Api_key || process.env.PINECONE_API_KEY;
const pineconeIndexName = process.env.PINECONE_INDEX || 'jarvis-gpt';

let jarvisIndex = null;
if (pineconeApiKey) {
    try {
        const pc = new Pinecone({ apiKey: pineconeApiKey });
        jarvisIndex = pc.Index(pineconeIndexName);
    } catch (error) {
        console.warn('Pinecone initialization failed. Vector memory disabled:', error.message);
    }
} else {
    console.warn('Pinecone API key is missing. Vector memory is disabled.');
}

async function createMemory({vector, metadata, messageId}) {
    try {
        if (!jarvisIndex) return;

        if (!Array.isArray(vector) || !vector.length) {
            console.warn('createMemory called with empty or invalid vector:', vector);
            return;
        }
        const id = String(messageId || Date.now());
        const payload = [{
            id,
            values: vector,
            metadata: metadata || {}
        }];
        const result = await jarvisIndex.upsert({ records: payload });
        console.log('Pinecone upsert result:', result);
    } catch (error) {
        console.error('Error creating memory:', error);
    }
}

async function queryMemory({vector, limit = 5, metadataFilter}) {
    try {
        if (!jarvisIndex) return [];

        const results = await jarvisIndex.query({
            vector: vector,
            topK: limit,
            filter: metadataFilter,
            includeMetadata: true
        });
        return results?.matches || [];
    } catch (error) {
        console.error('Error querying memory:', error);
        return [];
    }
}
module.exports = {
    createMemory,
    queryMemory
};