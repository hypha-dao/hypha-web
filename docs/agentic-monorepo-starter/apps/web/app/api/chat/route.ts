import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from "ai";
import { tools } from "@repo/agents";

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: "openai/gpt-5.4",
    system: "You are concise and helpful. Use tools only when needed.",
    messages: convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(5)
  });

  return result.toUIMessageStreamResponse();
}
