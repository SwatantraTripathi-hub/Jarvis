// Import the Pinecone library
const{ Pinecone } = require( '@pinecone-database/pinecone')

// Initialize a Pinecone client with your API key
const pc = new Pinecone({ apiKey: process.env.Pine_Cone_Api_key });

// Create a dense index with integrated embedding
const jarvisIndex =  pc.Index('jarvis-gpt');

async function createMemory({vector, metadata, messageId}) {
    try {
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
        throw error;
    }
}

async function queryMemory({vector, limit = 5, metadataFilter}) {
    try {
        const results = await jarvisIndex.query({
            vector: vector,
            topK: limit,
            filter: metadataFilter,
            includeMetadata: true
        });
        return results.matches;
    } catch (error) {
        console.error('Error querying memory:', error);
        throw error;
    }
}
module.exports = {
    createMemory,
    queryMemory
};