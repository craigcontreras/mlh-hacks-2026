import { afterEach, expect, test, vi } from 'vitest';
import { chartRankingProvider, runStructuredGemini } from './gemini';

afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

test('a configured Gemini request supplies a schema and reads the completed JSON response', async () => {
	vi.stubEnv('GEMINI_API_KEY', 'test-only');
	const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ candidates: [{
		finishReason: 'STOP', content: { parts: [{ thought: true, text: 'ignored' }, { text: '{"ids":["finding"]}' }] }
	}] }));
	vi.stubGlobal('fetch', fetcher);
	expect(chartRankingProvider()).toBe('gemini');
	const schema = { type: 'object' };
	await expect(runStructuredGemini(schema, 'ordered finding')).resolves.toEqual({ ids: ['finding'] });
	const [url, options] = fetcher.mock.calls[0];
	expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent');
	expect(options?.headers).toEqual({ 'content-type': 'application/json', 'x-goog-api-key': 'test-only' });
	expect(options?.signal).toBeInstanceOf(AbortSignal);
	if (typeof options?.body !== 'string') throw new Error('Expected a JSON request body.');
	expect(JSON.parse(options.body)).toMatchObject({
		contents: [{ role: 'user', parts: [{ text: 'ordered finding' }] }],
		generationConfig: { responseJsonSchema: schema, responseMimeType: 'application/json' }
	});
});

test('unavailable or incomplete model responses leave the local summary available', async () => {
	vi.stubEnv('GEMINI_API_KEY', 'test-only');
	const fetcher = vi.fn<typeof fetch>()
		.mockResolvedValueOnce(new Response(null, { status: 429 }))
		.mockResolvedValueOnce(Response.json({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: '{}' }] } }] }))
		.mockResolvedValueOnce(Response.json({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'truncated' }] } }] }))
		.mockRejectedValueOnce(new Error('temporary network failure'));
	vi.stubGlobal('fetch', fetcher);
	for (let i = 0; i < 4; i++) await expect(runStructuredGemini({}, 'test')).rejects.toThrow(/local chart summary/);
});

test('the default stays Codex and an unconfigured Gemini provider cannot start a request', async () => {
	vi.stubEnv('GEMINI_API_KEY', '');
	const fetcher = vi.fn();
	vi.stubGlobal('fetch', fetcher);
	expect(chartRankingProvider()).toBe('codex');
	await expect(runStructuredGemini({}, 'test')).rejects.toThrow(/local chart summary/);
	expect(fetcher).not.toHaveBeenCalled();
});
