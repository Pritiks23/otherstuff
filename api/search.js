export default async function handler(req, res) {
  try {
    const { query, user_id } = req.body;
    if (!query) return res.status(400).json({ error: "Missing query." });
    if (!user_id) return res.status(400).json({ error: "Missing user_id." });

    const TAVILY_API_KEY = process.env.TAVILY_API_KEY;
    const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
    if (!TAVILY_API_KEY || !CLAUDE_API_KEY)
      return res.status(500).json({ error: "Missing API keys." });

    // 🔹 1. Tavily Search
    const tavilyResp = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TAVILY_API_KEY}`,
      },
      body: JSON.stringify({ query, max_results: 5 }),
    });
    if (!tavilyResp.ok) {
      const txt = await tavilyResp.text();
      console.error("Tavily error:", txt);
      throw new Error("Tavily search failed");
    }
    const tavilyData = await tavilyResp.json();
    const results = tavilyData.results || [];

    // 🔹 2. Context for Claude
    const contextText = results.length
      ? results.map((r, i) => `${i + 1}) ${r.title}\n${r.content}\nSource: ${r.url}`).join("\n\n")
      : "No relevant Tavily results found.";

    // 🔹 3. Claude prompt
    const prompt = `
You are an expert AI assistant. Use ONLY the context below to answer the question.

CONTEXT:
${contextText}

QUESTION: ${query}

Respond ONLY with JSON in this exact structure:
{
  "intent": "",
  "confidence": "",
  "tldr": "",
  "short": "",
  "why": "",
  "implementation": "",
  "test": "",
  "alternatives": [],
  "caveats": [],
  "cost": "",
  "nextSteps": [],
  "sources": [{"title": "", "url": "", "note": ""}]
}
Do NOT include extra text.
`;

    // 🔹 4. Claude call
    const claudeResp = await fetch("https://api.anthropic.com/v1/messages", {
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
    if (!claudeResp.ok) {
      const txt = await claudeResp.text();
      console.error("Claude error:", txt);
      throw new Error("Claude API failed");
    }
    const claudeData = await claudeResp.json();
    const rawText = claudeData?.content?.[0]?.text || "{}";

    // 🔹 5. Parse JSON safely
    let answer = {};
    try { answer = JSON.parse(rawText); } catch (e) {
      console.error("Failed to parse Claude JSON:", rawText);
    }

    res.status(200).json({ results, answer });
  } catch (err) {
    console.error("Server error:", err);
    res.status(500).json({ error: "Server error occurred." });
  }
}
