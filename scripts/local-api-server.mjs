// ============================================
// NeuroGUARDIAN — Local API Development Server
// Alternative to `vercel dev` for Windows
// ============================================

import { createServer } from 'http';
import { parse } from 'url';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
config({ path: join(__dirname, '..', '.env') });
config({ path: join(__dirname, '..', '.env.local'), override: true });

// Dynamic import of the API handler
const PORT = process.env.API_PORT || 3001;

console.log('🚀 Starting NeuroGUARDIAN Local API Server...');
console.log('📁 Loading environment from .env');

// Force permissive mode for local dev to avoid Vault requirements
process.env.SECURITY_PERMISSIVE_MODE = 'true';
console.log('🛡️ SECURITY_PERMISSIVE_MODE forced to true for local dev');

// ======================================
// PATCH: Override @vercel/postgres with local pg
// ======================================
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL?.replace(/^"|"$/g, ''),  // Remove quotes if present
  ssl: { rejectUnauthorized: false },
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Create sql tagged template function compatible with @vercel/postgres
const sql = async (strings, ...values) => {
  const text = strings.reduce(
    (acc, str, i) => acc + str + (i < values.length ? `$${i + 1}` : ''),
    ''
  );
  const client = await pool.connect();
  try {
    return await client.query(text, values);
  } finally {
    client.release();
  }
};

// Inject into global for module resolution hack
globalThis.__VERCEL_POSTGRES_MOCK__ = { sql, pool };

// Patch require/import to intercept @vercel/postgres
import Module from 'module';
const originalRequire = Module.prototype.require;
Module.prototype.require = function(id) {
  if (id === '@vercel/postgres') {
    console.log('🔧 Intercepted @vercel/postgres, using local pg');
    return globalThis.__VERCEL_POSTGRES_MOCK__;
  }
  return originalRequire.apply(this, arguments);
};

console.log('✅ @vercel/postgres patched to use local pg driver');
// ======================================

async function startServer() {
  // Import the API handler (use dynamic import with tsx)
  const { default: handler } = await import('../api/index.ts');
  
  const server = createServer(async (req, res) => {
    console.log(`📡 [Server] Incoming ${req.method} request to ${req.url}`);
    
    // Parse URL
    const parsedUrl = parse(req.url || '', true);
    
    // Quick local health check - bypass main handler
    if (parsedUrl.query?.action === 'health') {
      try {
        const client = await pool.connect();
        const result = await client.query('SELECT 1 as ok');
        client.release();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          timestamp: new Date().toISOString(),
          database: result.rows[0]?.ok === 1 ? 'connected' : 'error',
          mode: 'local-dev',
        }));
        return;
      } catch (error) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'degraded',
          database: 'error',
          error: error.message,
        }));
        return;
      }
    }
    
    // Only handle /api routes
    if (!parsedUrl.pathname?.startsWith('/api')) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
      return;
    }
    
    // Convert to Vercel-like request/response objects
    const chunks = [];
    
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', async () => {
      try {
        // Parse body for POST requests
        let body = {};
        if (chunks.length > 0) {
          try {
            body = JSON.parse(Buffer.concat(chunks).toString());
          } catch {
            body = {};
          }
        }
        
        // Extract headers for auth and context
        const telegramId = req.headers['x-telegram-id'];
        const cronSecret = req.headers['x-cron-secret'];
        const isAdminBypass = cronSecret === process.env.CRON_SECRET;

        console.log('📨 Incoming Headers:', JSON.stringify(req.headers, null, 2));

        // Resolve userId if telegramId is provided (Admin/n8n context)
        let resolvedUserId = null;
        if (isAdminBypass && telegramId) {
          try {
            const { getUserInfoByTelegramId } = await import('../src/api-lib/services/database.js');
            // Note: We'll need to make sure database.js works locally!
            const user = await getUserInfoByTelegramId(telegramId);
            if (user) {
              resolvedUserId = user.id;
              console.log(`👤 Resolved user from X-Telegram-Id: ${telegramId} -> ${resolvedUserId}`);
            }
          } catch (e) {
            console.warn('⚠️ Failed to resolve userId from telegramId:', e.message);
          }
        }

        // Create Vercel-compatible request object
        const vercelReq = {
          method: req.method,
          url: req.url,
          headers: req.headers,
          query: parsedUrl.query,
          body,
          // Custom properties for our local environment
          isAdminBypass,
          telegramId,
          session: { userId: resolvedUserId } 
        };
        
        // Create Vercel-compatible response object
        const vercelRes = {
          statusCode: 200,
          headers: {},
          body: null,
          
          status(code) {
            this.statusCode = code;
            return this;
          },
          
          setHeader(name, value) {
            this.headers[name] = value;
            return this;
          },
          
          json(data) {
            this.headers['Content-Type'] = 'application/json';
            this.body = JSON.stringify(data);
            this._send();
            return this;
          },
          
          end(data) {
            this.body = data || '';
            this._send();
            return this;
          },
          
          _send() {
            res.writeHead(this.statusCode, this.headers);
            res.end(this.body);
          }
        };
        
        // --- MOE SUPPORT: Handle Inngest endpoint ---
        if (parsedUrl.pathname === '/api/inngest') {
          const { default: inngestHandler } = await import('../api/inngest.ts');
          return await inngestHandler(vercelReq, vercelRes);
        }

        // Call the main API handler
        await handler(vercelReq, vercelRes);
        
      } catch (error) {
        console.error('API Error:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: error.message }));
      }
    });
  });
  
  server.listen(PORT, () => {
    console.log(`\n✅ Local API Server running at http://localhost:${PORT}`);
    console.log(`\n📌 Configure Vite proxy to point to this server:`);
    console.log(`   Set VITE_LOCAL_BACKEND=true in .env.local`);
    console.log(`   Or manually set target: 'http://localhost:${PORT}' in vite.config.ts`);
    console.log(`\n🔧 Environment check:`);
    console.log(`   POSTGRES_URL: ${process.env.POSTGRES_URL ? '✅ Set' : '❌ Missing'}`);
    console.log(`   ADMIN_API_KEY: ${process.env.ADMIN_API_KEY ? '✅ Set' : '❌ Missing'}`);
    console.log(`   CRON_SECRET: ${process.env.CRON_SECRET ? '✅ Set' : '❌ Missing'}`);
    console.log(`\nPress Ctrl+C to stop\n`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
