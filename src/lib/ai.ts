type AIMessage = { role: "user" | "assistant"; content: string };

export async function callAI(
  system: string,
  messages: AIMessage[],
  maxTokens = 4096
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) throw new Error("GROQ_API_KEY manquante");

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        ...messages.map((m) => ({ role: m.role, content: m.content })),
      ],
    }),
  });

  const payload = await response.json().catch(() => ({})) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(payload.error?.message ?? `Erreur Groq ${response.status}`);
  }

  const text = payload.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) throw new Error("Réponse vide");
  return text;
}
