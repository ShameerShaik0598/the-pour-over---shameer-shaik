import type { LlmClient } from "@/lib/ai/client";
import type { ModelRequest } from "@/lib/ai/request";

type GeminiResponse = { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };

export class GeminiClient implements LlmClient {
  constructor(private readonly apiKey: string, private readonly model: string, private readonly fetcher: typeof fetch = fetch) {}

  async generate(request: ModelRequest): Promise<string> {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`;
    const response = await this.fetcher(endpoint, { method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": this.apiKey },
      body: JSON.stringify(request), signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error(`Gemini request failed with status ${response.status}`);
    const payload = await response.json() as GeminiResponse;
    const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("");
    if (!text) throw new Error("Gemini returned no plan");
    return text;
  }
}
