export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { imageBase64, metrics } = req.body;
    if (!imageBase64 || !metrics) return res.status(400).json({ error: 'Missing data' });

    const p = v => (parseFloat(v)*100).toFixed(0);

    // Prompt minimalista — resposta curta garante JSON completo
    const prompt = `Especialista em visagismo. Analise o rosto na imagem.

MÉTRICAS:
Proporção H/L:${metrics.ratioHL} Têmporas:${p(metrics.tempR)}% Testa:${p(metrics.foreR)}% Maçãs:${p(metrics.cheekR)}% Mandíbula:${p(metrics.jawHiR)}% Queixo:${p(metrics.chinR)}% CurvMand:${metrics.jawCurv}° Pontaqueixo:${metrics.chinPoint} TaperFJ:${p(metrics.taperForeJaw)}% TaperJC:${p(metrics.taperJawChin)}%

Preencha os campos do JSON com números inteiros de 0 a 100.
Não explique.
Não justifique.
Não raciocine.
Retorne apenas o JSON.

Responda APENAS com este JSON (sem texto extra, sem markdown):
{"s":{"ov":0,"re":0,"qu":0,"ob":0,"co":0,"ti":0,"di":0,"tr":0},"p":{"al":0,"an":0,"ps":0,"pi":0,"dm":0,"aq":0}}

Legenda scores: ov=oval re=redondo qu=quadrado ob=oblongo co=coracao ti=triangulo_inv di=diamante tr=triangular
Legenda perfil: al=alongamento an=angularidade ps=predominancia_superior pi=predominancia_inferior dm=destaque_macas aq=afunilamento_queixo`;

    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

    const body = {
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } }
        ]
      }],
     generationConfig: {
  temperature: 0,
  maxOutputTokens: 256,
  responseMimeType: "application/json"
}
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: 'Gemini API error', detail: err });
    }

    const data = await response.json();
    const raw =
  data.candidates?.[0]?.content?.parts
    ?.map(p => p.text || '')
    .join('') || '';
    console.log(JSON.stringify(data, null, 2));

    // Extrai JSON mesmo com texto ao redor
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'No JSON in response', raw });

    const compact = JSON.parse(jsonMatch[0]);

    // Expande as chaves compactas para o formato completo
    const result = {
      scores: {
        oval:         compact.s?.ov || 0,
        redondo:      compact.s?.re || 0,
        quadrado:     compact.s?.qu || 0,
        oblongo:      compact.s?.ob || 0,
        coracao:      compact.s?.co || 0,
        triangulo_inv:compact.s?.ti || 0,
        diamante:     compact.s?.di || 0,
        triangular:   compact.s?.tr || 0,
      },
      perfil: {
        alongamento:            compact.p?.al || 0,
        angularidade:           compact.p?.an || 0,
        predominancia_superior: compact.p?.ps || 0,
        predominancia_inferior: compact.p?.pi || 0,
        destaque_macas:         compact.p?.dm || 0,
        afunilamento_queixo:    compact.p?.aq || 0,
      }
    };

    return res.status(200).json(result);

  } catch(e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
