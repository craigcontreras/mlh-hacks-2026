import { ProviderError } from './codex';

export function chartRankingProvider(): 'codex' | 'gemini' {
	return process.env.GEMINI_API_KEY?.trim() ? 'gemini' : 'codex';
}

export async function runStructuredGemini(schema: object, prompt: string): Promise<unknown> {
	const key = process.env.GEMINI_API_KEY?.trim();
	const unavailable = 'Gemini could not order these findings. The local chart summary is available.';
	if (!key) throw new ProviderError(unavailable);
	try {
		const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent', {
			method: 'POST',
			redirect: 'error',
			headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
			signal: AbortSignal.timeout(8000),
			body: JSON.stringify({
				contents: [{ role: 'user', parts: [{ text: prompt }] }],
				generationConfig: {
					responseMimeType: 'application/json', responseJsonSchema: schema,
					maxOutputTokens: 512, thinkingConfig: { thinkingLevel: 'MINIMAL' }
				}
			})
		});
		if (!response.ok) throw new ProviderError(unavailable);
		const body = await response.json() as {
			candidates?: { finishReason?: string; content?: { parts?: { text?: string; thought?: boolean }[] } }[]
		};
		const candidate = body.candidates?.[0];
		const text = candidate?.content?.parts?.filter(part => !part.thought).map(part => part.text).join('');
		if (candidate?.finishReason !== 'STOP' || !text) throw new ProviderError(unavailable);
		return JSON.parse(text);
	} catch {
		throw new ProviderError(unavailable);
	}
}
