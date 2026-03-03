import { convertToModelMessages, streamText } from 'ai';
import { google } from '@ai-sdk/google';
import type { UIMessage } from 'ai';

export const maxDuration = 30;

const SYSTEM_PROMPT =
  'You are Hypha AI, a helpful assistant for the Hypha DAO platform. You help users analyze signals, draft proposals, understand community dynamics, and coordinate across spaces. Be concise and helpful.';

function getModel(modelId: string) {
  switch (modelId) {
    case 'gemini-2.5-flash':
      return google('gemini-2.5-flash');
    default:
      return google('gemini-2.5-flash');
  }
}

export async function POST(req: Request) {
  const {
    messages,
    modelId = 'gemini-2.5-flash',
  }: { messages: UIMessage[]; modelId?: string } = await req.json();

  const model = getModel(modelId);

  const result = streamText({
    model,
    system: SYSTEM_PROMPT,
    messages: await convertToModelMessages(messages),
  });

  return result.toUIMessageStreamResponse();
}
