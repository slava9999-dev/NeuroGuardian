export const db = {
  query: async (text: string, params?: unknown[]) => {
    // This is a wrapper to make it look like a standard pg client
    // @vercel/postgres uses tagged templates mostly, but supports query method too on the client.
    // However, `sql` is the recommended way.
    // For compatibility with the code that expects `db.query`, we can implement a basic adapter.
    // But `sql.query` allows raw strings? No, `sql` is a tag.
    // We can use `db` from `@vercel/postgres` if we import `db`.
    // Let's use the pool.

    // Actually, let's just use the `sql` tag for safety if possible, or `client`.
    // But since the user provided code uses `db.query`, let's try to map it.
    // The user code uses `db.query('SELECT ...', [params])`.

    // We need to import `db` from @vercel/postgres
    const { db: vercelDb } = await import('@vercel/postgres');
    return vercelDb.query(text, params);
  },
};
