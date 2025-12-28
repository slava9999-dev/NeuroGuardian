import type { VercelRequest, VercelResponse } from '@vercel/node';
import {
  getMarketplaceAccounts,
  addMarketplaceAccount,
  updateMarketplaceAccount,
  deleteMarketplaceAccount,
} from '../../src/api-lib/services/users.js';
import { encryptApiKey } from '../../src/api-lib/lib/crypto.js';
import { sanitizeInput } from '../../src/api-lib/lib/index.js';

/**
 * Handle marketplace accounts management
 */
export async function handleMarketplaceAccounts(
  req: VercelRequest,
  res: VercelResponse,
  userId: number
): Promise<VercelResponse> {
  const method = req.method;

  try {
    // GET: List accounts
    if (method === 'GET') {
      const accounts = await getMarketplaceAccounts(userId);
      // Remove sensitive data or mask it?
      // Usually frontend needs to know it exists. We can return masked.
      const safeAccounts = accounts.map(acc => ({
        ...acc,
        wb_token: acc.wb_token ? '***' : undefined,
        ozon_api_key: acc.ozon_api_key ? '***' : undefined,
        ozon_client_id: acc.ozon_client_id ? acc.ozon_client_id : undefined, // Client ID is not super secret usually, but can be masked
      }));
      return res.json({ success: true, accounts: safeAccounts });
    }

    // POST: Create or Update
    if (method === 'POST') {
      const body = req.body || {};
      const action = body.action || 'create'; // 'create' or 'update'

      if (action === 'delete') {
        // Handle delete via POST if DELETE method not supported by client (fallback)
        const accountId = Number(body.id);
        if (!accountId) return res.status(400).json({ error: 'Missing account ID' });
        const deleted = await deleteMarketplaceAccount(accountId, userId);
        if (!deleted) return res.status(404).json({ error: 'Account not found or access denied' });
        return res.json({ success: true, message: 'Account deleted' });
      }

      const {
        id,
        name,
        marketplace, // 'wb' or 'ozon'
        wbApiKey,
        ozonClientId,
        ozonApiKey,
        isActive,
      } = body;

      // Validate common
      if (!name) return res.status(400).json({ error: 'Name is required' });

      // Encrypt keys
      const encryptedWbKey = wbApiKey ? encryptApiKey(wbApiKey) : undefined;
      const encryptedOzonKey = ozonApiKey ? encryptApiKey(ozonApiKey) : undefined;
      const encryptedOzonClient = ozonClientId ? encryptApiKey(ozonClientId) : undefined; // Start encrypting Client ID too for consistency?
      // Existing code decodes Client ID?
      // In marketplace.ts: `decryptApiKey(account.ozon_client_id)` is called.
      // So yes, I MUST encrypt client ID too.

      if (id) {
        // UPDATE
        const accountId = Number(id);
        const updates: any = {
          name: sanitizeInput(name),
        };
        if (isActive !== undefined) updates.is_active = Boolean(isActive);
        if (wbApiKey) updates.wb_token = encryptedWbKey;
        if (ozonApiKey) updates.ozon_api_key = encryptedOzonKey;
        if (ozonClientId) updates.ozon_client_id = encryptedOzonClient;

        const updated = await updateMarketplaceAccount(accountId, userId, updates);
        if (!updated) return res.status(404).json({ error: 'Account not found' });

        return res.json({
          success: true,
          account: { ...updated, wb_token: undefined, ozon_api_key: undefined },
        });
      } else {
        // CREATE
        if (!marketplace) return res.status(400).json({ error: 'Marketplace type required' });

        const newAccount = await addMarketplaceAccount({
          user_id: userId,
          name: sanitizeInput(name),
          marketplace: marketplace as 'wb' | 'ozon',
          is_active: isActive !== undefined ? Boolean(isActive) : true,
          wb_token: encryptedWbKey,
          ozon_client_id: encryptedOzonClient,
          ozon_api_key: encryptedOzonKey,
        });

        return res.json({
          success: true,
          account: { ...newAccount, wb_token: undefined, ozon_api_key: undefined },
        });
      }
    }

    // DELETE
    if (method === 'DELETE') {
      const accountId = Number(req.query.id || req.body?.id);
      if (!accountId) return res.status(400).json({ error: 'Missing account ID' });

      const deleted = await deleteMarketplaceAccount(accountId, userId);
      if (!deleted) return res.status(404).json({ error: 'Account not found' });
      return res.json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Marketplace Accounts Error:', error);
    return res
      .status(500)
      .json({ error: error instanceof Error ? error.message : 'Internal Server Error' });
  }
}
