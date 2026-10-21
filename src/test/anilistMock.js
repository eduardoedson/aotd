import { vi } from 'vitest';

// Replaces fetch with a fake AniList endpoint. The resolver receives the operation
// name and variables and returns { status, body, headers } or just { data }.
export function mockAnilist(resolver) {
  const fetchMock = vi.fn(async (_url, init) => {
    const { query, variables } = JSON.parse(init.body);
    const name = query.match(/query\s+(\w+)/)?.[1];
    const result = (await resolver({ name, variables })) ?? { status: 404, body: {} };
    const { status = 200, headers = {} } = result;
    const body = 'data' in result ? { data: result.data } : result.body;
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', ...headers },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export const graphQLError = (status, message) => ({
  status,
  body: { data: null, errors: [{ message, status }] },
});
