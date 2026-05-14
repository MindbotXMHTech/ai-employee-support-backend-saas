type QueryResult = {
  data?: unknown;
  error?: unknown;
  count?: number | null;
};

export function createChain(result: QueryResult = {}) {
  const chain = {
    select: () => chain,
    eq: () => chain,
    gte: () => chain,
    order: () => chain,
    limit: () => chain,
    insert: () => chain,
    update: () => chain,
    delete: () => chain,
    upsert: () => chain,
    maybeSingle: async () => ({ data: result.data ?? null, error: result.error ?? null }),
    single: async () => ({ data: result.data ?? null, error: result.error ?? null }),
  };
  return chain;
}

export function createSupabaseMock(tableResults: Record<string, QueryResult | QueryResult[]>) {
  const tableCalls: string[] = [];

  return {
    tableCalls,
    client: {
      from: (table: string) => {
        tableCalls.push(table);
        const result = tableResults[table];
        if (Array.isArray(result)) {
          return createChain(result.shift());
        }
        return createChain(result);
      },
      storage: {
        from: () => ({
          remove: async () => ({ data: null, error: null }),
        }),
      },
      rpc: async () => ({ data: [], error: null }),
    },
  };
}
