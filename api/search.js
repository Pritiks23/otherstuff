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
      body: JSON.stringify({ 
        query, 
        max_results: 5,
      }),
    });

    const tavilyData = await tavilyResponse.json();
    const results = tavilyData.results || [];

    // 2️⃣ Build context for Claude
    const contextText = results.length
      ? results.map((r, i) => `${i + 1}) ${r.title}\n${r.content}\nSource: ${r.url}`).join("\n\n")
      : "No relevant Tavily results found.";

    // 3️⃣ Prompt for Claude
    const prompt = `
System: You are an expert AI engineering assistant.
Tone rules: confident, concise, direct. Use active voice.
If uncertain about a fact, quantify uncertainty and give a short plan to verify.

Respond using ONLY the sources listed in 'evidence' unless explicitly marked speculation.
Output must match this exact JSON schema:
Output only valid JSON. Do not wrap the JSON in markdown, code fences, or strings. Each key must be top-level.
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

CONTEXT:
${contextText}

QUESTION: ${query}
`;

    // 4️⃣ Claude API call
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
          max_tokens: 2000,
          messages: [{ role: "user", content: prompt }],
        }),
      });

      const claudeData = await claudeResponse.json();
      const rawText = claudeData?.content?.[0]?.text || "{}";

      // ✅ Extract JSON from raw text
      try {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/); // Grab JSON block
        if (jsonMatch) {
          answer = JSON.parse(jsonMatch[0]);
        } else {
          answer = { tldr: rawText };
        }
      } catch (e) {
        console.error("Claude JSON parse error:", e);
        answer = { tldr: rawText };
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

