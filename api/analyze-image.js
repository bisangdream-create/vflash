export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Vercel 환경 변수에 GEMINI_API_KEY가 설정되지 않았습니다.' });
    }

    const { imageBase64, mimeType } = req.body || {};

    if (!imageBase64) {
      return res.status(400).json({ error: '이미지 데이터가 전달되지 않았습니다.' });
    }

    const promptText = `Analyze this image containing Chinese characters (Hanzi), English, or Korean vocabulary.
Extract all vocabulary words with their meanings.

STRICT FORMATTING RULES:
1. For Chinese characters (Hanzi): Output ONLY the pure Hanzi in "word" (no pinyin, no pronunciation, no Korean reading, no extra text).
2. For English words: Output ONLY the pure English word in "word" (no phonetic symbols, no translation).
3. For meanings: Output ONLY the clean meaning in Korean (or target explanation).
4. Do NOT combine languages or add pronunciation below/next to the word.

Output strictly valid JSON array without markdown formatting or code blocks:
[
  {"word": "單字/Word", "meaning": "뜻/해설"}
]`;

    // Using gemini-3.5-flash-lite as requested
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`;

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: promptText },
            { inlineData: { mimeType: mimeType || 'image/jpeg', data: imageBase64 } }
          ]
        }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || 'Gemini API 호출에 실패했습니다.'
      });
    }

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
    let cleanJson = rawText.trim();
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    } else if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    const parsedCards = JSON.parse(cleanJson);

    return res.status(200).json(parsedCards);

  } catch (err) {
    return res.status(500).json({
      error: err.message || '서버 오류가 발생했습니다.'
    });
  }
}
