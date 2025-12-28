#!/usr/bin/env node

/**
 * ============================================
 * Security Agent - Vault Initialization Script
 * ============================================
 * Sets up HashiCorp Vault for local development
 * Run: npm run vault:init
 * ============================================
 */

const VAULT_ADDR = process.env.VAULT_ADDR || 'http://localhost:8200';
const VAULT_TOKEN = process.env.VAULT_TOKEN || 'dev-only-token';

async function initializeVault() {
  console.log('🔐 Initializing HashiCorp Vault...\n');
  console.log(`Vault Address: ${VAULT_ADDR}`);

  try {
    // Check Vault health
    const healthResponse = await fetch(`${VAULT_ADDR}/v1/sys/health`);
    if (!healthResponse.ok) {
      throw new Error('Vault is not healthy');
    }
    console.log('✅ Vault is healthy\n');

    // Enable KV secrets engine (v2)
    console.log('📁 Enabling KV secrets engine...');
    try {
      await vaultRequest('POST', '/v1/sys/mounts/secret', {
        type: 'kv',
        options: { version: '2' },
      });
      console.log('✅ KV secrets engine enabled\n');
    } catch (error) {
      // Already enabled - this is fine
      console.log('ℹ️  KV secrets engine already enabled\n');
    }

    // Create policies
    console.log('📜 Creating security policies...\n');

    // Read-only policy for most services
    await createPolicy('security-agent-readonly', `
      # Read secrets for NeuroGUARDIAN
      path "secret/data/neuroguardian/*" {
        capabilities = ["read"]
      }
      
      path "secret/metadata/neuroguardian/*" {
        capabilities = ["read", "list"]
      }
    `);

    // Full access policy for admin operations
    await createPolicy('security-agent-admin', `
      # Full access to NeuroGUARDIAN secrets
      path "secret/data/neuroguardian/*" {
        capabilities = ["create", "read", "update", "delete"]
      }
      
      path "secret/metadata/neuroguardian/*" {
        capabilities = ["read", "list", "delete"]
      }
      
      path "secret/delete/neuroguardian/*" {
        capabilities = ["update"]
      }
    `);

    // n8n-specific policy
    await createPolicy('security-agent-n8n', `
      # Limited access for n8n workflows
      path "secret/data/neuroguardian/n8n/*" {
        capabilities = ["read"]
      }
      
      path "secret/data/neuroguardian/wb_api_key" {
        capabilities = ["read"]
      }
      
      path "secret/data/neuroguardian/ozon_*" {
        capabilities = ["read"]
      }
    `);

    console.log('✅ Policies created\n');

    // Create initial secrets (development only!)
    console.log('🔑 Creating sample secrets (development only)...\n');

    const devSecrets = [
      { key: 'telegram_bot_token', value: 'dev-telegram-token-replace-me' },
      { key: 'admin_api_key', value: 'dev-admin-key-replace-me' },
      { key: 'cron_secret', value: 'dev-cron-secret-replace-me' },
      { key: 'api_key_encryption_key', value: 'dev-encryption-key-32-chars!!' },
      { key: 'openai_api_key', value: 'sk-dev-replace-with-real-key' },
      { key: 'groq_api_key', value: 'gsk_dev-replace-with-real-key' },
      { key: 'serper_api_key', value: 'dev-serper-key-replace-me' },
      { key: 'yookassa_shop_id', value: 'dev-shop-id' },
      { key: 'yookassa_secret_key', value: 'dev-secret-key' },
      { key: 'kv_rest_api_url', value: 'https://your-upstash-url' },
      { key: 'kv_rest_api_token', value: 'dev-upstash-token' },
      { key: 'security_signing_key', value: 'dev-signing-key-change-in-production-32chars' },
    ];

    for (const { key, value } of devSecrets) {
      await createSecret(key, value);
    }

    // Create user-specific secrets structure
    console.log('\n📂 Creating user secrets structure...');
    await createSecret('users/demo_user/wb_api_key', 'demo-wb-api-key');
    await createSecret('users/demo_user/ozon_client_id', 'demo-ozon-client-id');
    await createSecret('users/demo_user/ozon_api_key', 'demo-ozon-api-key');

    // Create n8n workflow credentials
    console.log('\n📂 Creating n8n credentials structure...');
    await createSecret('n8n/api_key', 'n8n-internal-api-key');
    await createSecret('n8n/webhook_secret', 'n8n-webhook-secret');

    console.log('\n✅ Vault initialization complete!\n');
    console.log('📋 Summary:');
    console.log('   - KV secrets engine: enabled');
    console.log('   - Policies: security-agent-readonly, security-agent-admin, security-agent-n8n');
    console.log('   - Sample secrets: created (REPLACE IN PRODUCTION!)');
    console.log('');
    console.log('⚠️  IMPORTANT: Replace all dev secrets with real values!');
    console.log('   Use: vault kv put secret/neuroguardian/<key> value=<real-value>');
    console.log('');

  } catch (error) {
    console.error('❌ Vault initialization failed:', error);
    console.log('');
    console.log('💡 Make sure Vault is running:');
    console.log('   docker-compose -f security-agent/docker-compose.yml up -d vault');
    console.log('');
    process.exit(1);
  }
}

async function vaultRequest(method, path, body) {
  const response = await fetch(`${VAULT_ADDR}${path}`, {
    method,
    headers: {
      'X-Vault-Token': VAULT_TOKEN,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok && response.status !== 204) {
    const text = await response.text();
    throw new Error(`Vault request failed: ${response.status} - ${text}`);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

async function createPolicy(name, rules) {
  try {
    await vaultRequest('PUT', `/v1/sys/policies/acl/${name}`, {
      policy: rules.trim(),
    });
    console.log(`   ✓ Policy: ${name}`);
  } catch (error) {
    console.log(`   ⚠️ Policy ${name}: ${error.message}`);
  }
}

async function createSecret(key, value) {
  try {
    await vaultRequest('POST', `/v1/secret/data/neuroguardian/${key}`, {
      data: {
        value,
        createdAt: new Date().toISOString(),
        createdBy: 'init-script',
      },
    });
    console.log(`   ✓ Secret: ${key}`);
  } catch (error) {
    console.log(`   ⚠️ Secret ${key}: ${error.message}`);
  }
}

// Run initialization
initializeVault();
