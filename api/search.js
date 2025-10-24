export default async function handler(req, res) {
  const { query } = req.body;
  const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
  const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

  try {
    // 1️⃣ Tavily search
    const tavilyResponse = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TAVILY_API_KEY}`,
      },
      body: JSON.stringify({ query, max_results: 5 }),
    });

    const tavilyData = await tavilyResponse.json();
    const results = tavilyData.results || [];

    // Format results as context
    const contextText = results.length
      ? results.map((r, i) => `${i + 1}) ${r.title}\n${r.content}\nSource: ${r.url}`).join("\n\n")
      : "No relevant Tavily results found.";

    // 2️⃣ Claude prompt
    const prompt = `
System: You are an expert AI engineering assistant.
Tone: confident, concise, direct. Use active voice.
Only use the sources provided in 'evidence'. Quantify uncertainty if needed.

Respond using this JSON schema ONLY:
{
  "intent": "string",
  "confidence": "string",
  "tldr": "string",
  "short": "string",
  "why": "string",
  "implementation": "string",
  "test": "string",
  "alternatives": ["string"],
  "caveats": ["string"],
  "cost": "string",
  "sources": [{"title":"", "url":"", "note":""}],
  "nextSteps": ["string"]
}

CONTEXT (evidence from Tavily):
${contextText}

QUESTION: ${query}
`;

    // 3️⃣ Call Claude
    let answer = {};
    try {
      const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": CLAUDE_API_KEY,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-3-5-sonnet-20241022",
          max_tokens: 1500,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const claudeData = await claudeResponse.json();
      const rawText = claudeData?.content?.[0]?.text || "{}";

      try {
        answer = JSON.parse(rawText);
      } catch {
        answer = { tldr: rawText || "Claude response parse failed." };
      }
    } catch (e) {
      console.error("Claude API error:", e);
      answer = { tldr: "Claude summary unavailable." };
    }

    res.status(200).json({ results, answer });
  } catch (err) {
    console.error("Tavily fetch error:", err);
    res.status(500).json({ error: "Server error." });
  }
}

