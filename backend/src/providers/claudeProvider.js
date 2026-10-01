import Anthropic from "@anthropic-ai/sdk";

let client;

function getClient() {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured.");
  }

  if (!client) {
    client = new Anthropic({
      apiKey,
    });
  }

  return client;
}

export async function generateClaudeResponse(prompt) {
  if (!prompt?.trim()) {
    throw new Error("A prompt is required.");
  }

  const model = process.env.ANTHROPIC_MODEL;

  if (!model) {
    throw new Error("ANTHROPIC_MODEL is not configured.");
  }

  const anthropic = getClient();

  const message = await anthropic.messages.create({
    model,
    max_tokens: 1000,

    system: `
You are the AI assistant for a college Study Companion application.

Help students understand and review academic material.

You may:
- summarize study material
- generate flashcards
- generate quizzes
- explain difficult concepts

Base responses primarily on material provided by the student.
Do not invent unsupported information.
Follow requested output formats exactly.
    `.trim(),

    messages: [
      {
        role: "user",
        content: prompt,
      },
    ],
  });

  return message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}
