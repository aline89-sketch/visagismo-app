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

    const pct = v => (parseFloat(v) * 100).toFixed(0) + '%';

    const prompt = `Você é especialista em visagismo. Analise o rosto na imagem com o contorno traçado.

MÉTRICAS MEDIAPIPE:
- Proporção H/L: ${metrics.ratioHL}
- Têmporas: ${pct(metrics.tempR)} | Testa: ${pct(metrics.foreR)} | Maçãs: ${pct(metrics.cheekR)}
- Mandíbula: ${pct(metrics.jawHiR)} | Queixo: ${pct(metrics.chinR)}
- Curvatura mandíbula: ${metrics.jawCurv}° | Uniformidade: ${pct(metrics.jawUniform)}
- Pontualidade queixo: ${metrics.chinPoint}
- Afunilamento testa→mand: ${pct(metrics.taperForeJaw)} | mand→queixo: ${pct(metrics.taperJawChin)}

TAREFA 1 - Pontue cada formato de 0 a 100 (soma não precisa ser 100):
oval, redondo, quadrado, oblongo, coracao, triangulo_inv, diamante, triangular

TAREFA 2 - Perfil facial contínuo (0-100):
- alongamento: 0=muito curto, 100=muito longo
- angularidade: 0=muito suave, 100=muito angular
- predominancia_superior: 0=base larga, 100=topo muito largo
- predominancia_inferior: 0=topo largo, 100=base muito larga
- destaque_macas: 0=maçãs não se destacam, 100=maçãs muito proeminentes
- afunilamento_queixo: 0=queixo largo/reto, 100=queixo muito pontudo

Retorne SOMENTE este JSON:
{"scores":{"oval":0,"redondo":0,"quadrado":0,"oblongo":0,"coracao":0,"triangulo_inv":0,"diamante":0,"triangular":0},"perfil":{"alongamento":0,"angularidade":0,"predominancia_superior":0,"predominancia_inferior":0,"destaque_macas":0,"afunilamento_queixo":0}}`;

    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const body = {
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } }
        ]
      }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1024 }
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
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = raw.replace(/```json|```/g, '').trim();
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'No JSON in response', raw });
    const result = JSON.parse(jsonMatch[0]);
    return res.status(200).json(result);

  } catch(e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
