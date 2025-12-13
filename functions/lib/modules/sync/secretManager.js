"use strict";
// ============================================
// NeuroGUARDIAN — Secret Manager Integration
// Secure storage for API keys
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.storeApiKey = storeApiKey;
exports.getApiKey = getApiKey;
exports.deleteApiKey = deleteApiKey;
exports.hasApiKey = hasApiKey;
const secret_manager_1 = require("@google-cloud/secret-manager");
const client = new secret_manager_1.SecretManagerServiceClient();
const projectId = process.env.GOOGLE_CLOUD_PROJECT || 'neuroguardian';
/**
 * Generate secret name for user's API key
 */
function getSecretName(telegramId, marketplace) {
    return `user-${telegramId}-${marketplace.toLowerCase()}-api-key`;
}
/**
 * Store API key in Secret Manager
 * @returns Reference to the secret (for storing in Firestore)
 */
async function storeApiKey(telegramId, marketplace, apiKey, clientId // Required for Ozon
) {
    const secretId = getSecretName(telegramId, marketplace);
    const parent = `projects/${projectId}`;
    const secretPath = `${parent}/secrets/${secretId}`;
    // Prepare the data to store
    const data = marketplace === 'Ozon' && clientId
        ? JSON.stringify({ apiKey, clientId })
        : apiKey;
    try {
        // Try to create the secret first
        try {
            await client.createSecret({
                parent,
                secretId,
                secret: {
                    replication: {
                        automatic: {},
                    },
                    labels: {
                        telegram_id: telegramId.toString(),
                        marketplace: marketplace.toLowerCase(),
                    },
                },
            });
            console.log(`Created new secret: ${secretId}`);
        }
        catch (error) {
            // Secret might already exist (ALREADY_EXISTS error code 6)
            if (error.code !== 6) {
                throw error;
            }
            console.log(`Secret already exists: ${secretId}`);
        }
        // Add a new version with the API key
        await client.addSecretVersion({
            parent: secretPath,
            payload: {
                data: Buffer.from(data, 'utf8'),
            },
        });
        console.log(`Stored API key for user ${telegramId}, marketplace ${marketplace}`);
        // Return reference to store in Firestore
        return `${secretPath}/versions/latest`;
    }
    catch (error) {
        console.error('Error storing API key:', error);
        throw new Error('FAILED_TO_STORE_API_KEY');
    }
}
/**
 * Retrieve API key from Secret Manager
 */
async function getApiKey(telegramId, marketplace) {
    const secretId = getSecretName(telegramId, marketplace);
    const secretPath = `projects/${projectId}/secrets/${secretId}/versions/latest`;
    try {
        const [version] = await client.accessSecretVersion({
            name: secretPath,
        });
        if (!version.payload?.data) {
            console.error('Secret payload is empty');
            return null;
        }
        const data = version.payload.data.toString();
        // Check if it's JSON (Ozon with clientId)
        try {
            const parsed = JSON.parse(data);
            return {
                apiKey: parsed.apiKey,
                clientId: parsed.clientId,
            };
        }
        catch {
            // Plain string (WB)
            return { apiKey: data };
        }
    }
    catch (error) {
        if (error.code === 5) {
            // NOT_FOUND
            console.log(`No API key found for user ${telegramId}, marketplace ${marketplace}`);
            return null;
        }
        console.error('Error retrieving API key:', error);
        throw new Error('FAILED_TO_RETRIEVE_API_KEY');
    }
}
/**
 * Delete API key from Secret Manager
 */
async function deleteApiKey(telegramId, marketplace) {
    const secretId = getSecretName(telegramId, marketplace);
    const secretPath = `projects/${projectId}/secrets/${secretId}`;
    try {
        await client.deleteSecret({
            name: secretPath,
        });
        console.log(`Deleted API key for user ${telegramId}, marketplace ${marketplace}`);
    }
    catch (error) {
        if (error.code === 5) {
            // NOT_FOUND - already deleted
            console.log(`Secret already deleted: ${secretId}`);
            return;
        }
        console.error('Error deleting API key:', error);
        throw new Error('FAILED_TO_DELETE_API_KEY');
    }
}
/**
 * Check if API key exists for a user
 */
async function hasApiKey(telegramId, marketplace) {
    try {
        const key = await getApiKey(telegramId, marketplace);
        return key !== null;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=secretManager.js.map