// ============================================
// NeuroGUARDIAN — Local API Development Server (V2)
// Improved binding and logging
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

const PORT = process.env.API_PORT || 3001;
const HOST = '0.0.0.0'; // Bind to all interfaces for Docker compatibility

console.log('🚀 Starting NeuroGUARDIAN Local API Server (V2)...');

async function startServer() {
  // Import the API handler
  const { default: handler } = await import('../api/index.js');
  
  const server = createServer(async (req, res) => {
    // Parse URL
    const parsedUrl = parse(req.url || '', true);
    console.log(`\n📥 ${req.method} ${req.url}`);
    
    // Only handle /api routes
    if (!parsedUrl.pathname?.startsWith('/api')) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found', path: parsedUrl.pathname }));
      return;
    }
    
    const chunks = [];
    
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', async () => {
      try {
        let body = {};
        if (chunks.length > 0) {
          try {
            body = JSON.parse(Buffer.concat(chunks).toString());
          } catch {
            body = {};
          }
        }
        
        // Extract headers
        const telegramId = req.headers['x-telegram-id'];
        let cronSecret = req.headers['x-cron-secret'];
        
        // Also check Authorization header for Bearer token if x-cron-secret is missing
        if (!cronSecret && req.headers['authorization']) {
          const authParts = req.headers['authorization'].split(' ');
          if (authParts.length === 2 && authParts[0] === 'Bearer') {
            cronSecret = authParts[1];
          }
        }
        
        const isAdminBypass = cronSecret === process.env.CRON_SECRET;

        // Vercel-compatible Request
        const vercelReq = {
          method: req.method,
          url: req.url,
          headers: req.headers,
          query: parsedUrl.query,
          body,
          isAdminBypass,
          telegramId
        };
        
        // Vercel-compatible Response
        const vercelRes = {
          statusCode: 200,
          headers: {},
          body: null,
          status(code) { this.statusCode = code; return this; },
          setHeader(name, value) { this.headers[name] = value; return this; },
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
            if (this.sent) return;
            this.sent = true;
            res.writeHead(this.statusCode, this.headers);
            res.end(this.body);
            // console.log(`📤 Sent ${this.statusCode}`);
          }
        };
        
        await handler(vercelReq, vercelRes);
        
      } catch (error) {
        console.error('❌ API Error:', error);
        if (!res.writableEnded) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: error.message }));
        }
      }
    });
  });
  
  server.listen(PORT, HOST, () => {
    console.log(`\n✅ Local API Server running at http://${HOST}:${PORT}`);
    console.log(`   Internal Docker URL: http://host.docker.internal:${PORT}/api`);
  });
  
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE') {
      console.error('❌ Address in use, retrying...');
      setTimeout(() => {
        server.close();
        server.listen(PORT, HOST);
      }, 1000);
    } else {
      console.error('❌ Server error:', e);
    }
  });
}

startServer();
