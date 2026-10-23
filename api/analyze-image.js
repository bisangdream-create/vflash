export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Vercel 환경 변수에 GEMINI_API_KEY가 설정되지 않았습니다.' });
    }

    const { imageBase64, mimeType, targetMode } = req.body || {};

    if (!imageBase64) {
      return res.status(400).json({ error: '이미지 데이터가 전달되지 않았습니다.' });
    }

    let modeInstruction = "";

    if (targetMode === 'hanzi') {
      modeInstruction = `
[MODE: KOREAN TO HANZI]
- Extract Korean words/vocabulary from the image for "word".
- For "meaning": Provide ONLY the exact corresponding Chinese character(s) (Hanzi/漢字) for each Korean word.
- Do NOT include pinyin, pronunciation, or extra Korean explanations.
- Output ONLY pure Hanzi in "meaning".`;
    } else if (targetMode === 'english') {
      modeInstruction = `
[MODE: KOREAN TO ENGLISH]
- Extract Korean words/vocabulary from the image for "word".
- For "meaning": Provide ONLY the pure English translation/word corresponding to the Korean word.
- Do NOT include phonetic symbols or extra explanations.
- Output ONLY pure English in "meaning".`;
    } else {
      modeInstruction = `
[MODE: AUTO DETECT]
- Extract all vocabulary (Hanzi, English, or Korean) from the image.
- For Hanzi/English words in the image: Output pure word in "word" and Korean meaning in "meaning".
- For Korean words in the image: Output Korean in "word" and pure Hanzi/English in "meaning".`;
    }

    const promptText = `Analyze this image containing vocabulary/words.
Extract all target vocabulary with their corresponding counterpart according to these strict rules:

${modeInstruction}

STRICT FORMATTING RULES:
1. "word": Pure target word (Korean/English/Hanzi) without extra tags.
2. "meaning": Pure counterpart (Hanzi, English, or Korean) without any pronunciation or extra explanation.
3. Keep the output strictly as a valid JSON array without markdown formatting or code blocks:
[
  {"word": "단어", "meaning": "뜻/한자/영어"}
]`;

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
