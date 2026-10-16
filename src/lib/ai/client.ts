import type { ModelRequest } from "@/lib/ai/request";

export interface LlmClient {
  generate(request: ModelRequest): Promise<string>;
}
