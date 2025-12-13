"use strict";
// ============================================
// NeuroGUARDIAN — Dispatcher Function
// Cloud Scheduler triggered function
// Creates Cloud Tasks for each active user
// ============================================
Object.defineProperty(exports, "__esModule", { value: true });
exports.dispatch = dispatch;
exports.createUrgentCheck = createUrgentCheck;
exports.createProductCheck = createProductCheck;
const tasks_1 = require("@google-cloud/tasks");
const firestore_1 = require("../../lib/firestore");
const tasksClient = new tasks_1.CloudTasksClient();
// Configuration
const PROJECT_ID = process.env.GOOGLE_CLOUD_PROJECT || 'neuroguardian';
const LOCATION = process.env.FUNCTIONS_REGION || 'us-central1';
const QUEUE_NAME = process.env.TASKS_QUEUE_NAME || 'sentinel-worker-queue';
const WORKER_URL = process.env.WORKER_FUNCTION_URL ||
    `https://${LOCATION}-${PROJECT_ID}.cloudfunctions.net/sentinelWorker`;
/**
 * Create a Cloud Task for a single user
 */
async function createWorkerTask(userId, priority = 'normal') {
    const queuePath = tasksClient.queuePath(PROJECT_ID, LOCATION, QUEUE_NAME);
    const payload = {
        userId,
        priority,
    };
    const task = {
        httpRequest: {
            httpMethod: 'POST',
            url: WORKER_URL,
            headers: {
                'Content-Type': 'application/json',
            },
            body: Buffer.from(JSON.stringify(payload)).toString('base64'),
            oidcToken: {
                serviceAccountEmail: `${PROJECT_ID}@appspot.gserviceaccount.com`,
            },
        },
        scheduleTime: {
            seconds: Math.floor(Date.now() / 1000) + (priority === 'high' ? 0 : 5),
        },
    };
    const [response] = await tasksClient.createTask({
        parent: queuePath,
        task,
    });
    console.log(`Created task for user ${userId}: ${response.name}`);
    return response.name || '';
}
/**
 * Main dispatcher function
 * Called by Cloud Scheduler every 1-2 minutes
 */
async function dispatch() {
    console.log('Dispatcher starting...');
    const startTime = Date.now();
    try {
        // Get all users with protection enabled
        const activeUsers = await (0, firestore_1.getActiveProtectedUsers)();
        console.log(`Found ${activeUsers.length} users with protection enabled`);
        if (activeUsers.length === 0) {
            return { totalUsers: 0, tasksCreated: 0, errors: 0 };
        }
        let tasksCreated = 0;
        let errors = 0;
        // Create tasks for each user
        // Use Promise.allSettled to not fail on individual errors
        const results = await Promise.allSettled(activeUsers.map(async (user) => {
            try {
                await createWorkerTask(user.telegramId);
                return true;
            }
            catch (error) {
                console.error(`Failed to create task for user ${user.telegramId}:`, error);
                return false;
            }
        }));
        for (const result of results) {
            if (result.status === 'fulfilled' && result.value) {
                tasksCreated++;
            }
            else {
                errors++;
            }
        }
        const duration = Date.now() - startTime;
        console.log(`Dispatcher completed in ${duration}ms. Created ${tasksCreated} tasks, ${errors} errors`);
        return {
            totalUsers: activeUsers.length,
            tasksCreated,
            errors,
        };
    }
    catch (error) {
        console.error('Dispatcher error:', error);
        throw error;
    }
}
/**
 * Create a high-priority task (e.g., when user manually triggers check)
 */
async function createUrgentCheck(userId) {
    await createWorkerTask(userId, 'high');
    console.log(`Created urgent check task for user ${userId}`);
}
/**
 * Create tasks for specific products only
 */
async function createProductCheck(userId, productIds) {
    const queuePath = tasksClient.queuePath(PROJECT_ID, LOCATION, QUEUE_NAME);
    const payload = {
        userId,
        productIds,
        priority: 'high',
    };
    const task = {
        httpRequest: {
            httpMethod: 'POST',
            url: WORKER_URL,
            headers: {
                'Content-Type': 'application/json',
            },
            body: Buffer.from(JSON.stringify(payload)).toString('base64'),
            oidcToken: {
                serviceAccountEmail: `${PROJECT_ID}@appspot.gserviceaccount.com`,
            },
        },
    };
    await tasksClient.createTask({
        parent: queuePath,
        task,
    });
    console.log(`Created product check task for user ${userId}, ${productIds.length} products`);
}
//# sourceMappingURL=dispatcher.js.map