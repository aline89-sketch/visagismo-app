export const config = { maxDuration: 30 };

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

    const prompt = `Você é um especialista em visagismo com profundo conhecimento em formatos de rosto.
Analise a imagem do rosto com o contorno traçado e as métricas fornecidas.

FORMATOS POSSÍVEIS (apenas estes 8):
- oval: proporções equilibradas, maçãs = ponto mais largo, testa levemente maior que mandíbula, curvas suaves
- redondo: largura ≈ altura (ratio < 1.20), bochechas cheias, mandíbula curva e suave
- quadrado: larguras similares em todas as regiões, mandíbula angular, queixo reto e curto
- oblongo: rosto bem mais comprido que largo (ratio > 1.50), lados suaves e paralelos
- coracao: testa e maçãs largas, queixo fino e PONTUDO, mandíbula afunila bastante
- triangulo_inv: testa e têmporas largas, afunila progressivamente, queixo ARREDONDADO
- diamante: maçãs MUITO proeminentes, testa E mandíbula visivelmente estreitas
- triangular: mandíbula mais larga que a testa, rosto alarga para baixo

HIERARQUIA DE ANÁLISE:
1. Qual região domina: superior (testa/têmporas), maçãs ou inferior (mandíbula)?
2. Superior dominante → coração (queixo pontudo) ou triângulo invertido (queixo arredondado)
3. Maçãs dominantes → diamante (testa E mandíbula estreitas) ou oval/redondo
4. Inferior dominante → triangular
5. Equilibrado → oval, redondo, quadrado ou oblongo

MÉTRICAS MEDIDAS (normalizadas pela largura máxima):
- Proporção altura/largura: ${metrics.ratioHL}
- Têmporas: ${pct(metrics.tempR)}
- Testa (hairline): ${pct(metrics.foreR)}
- Maçãs: ${pct(metrics.cheekR)}
- Mandíbula: ${pct(metrics.jawHiR)}
- Queixo: ${pct(metrics.chinR)}
- Curvatura mandíbula: ${metrics.jawCurv}° (< 128° = angular/quadrado, > 148° = suave)
- Uniformidade mandíbula: ${pct(metrics.jawUniform)} (> 87% = reta/quadrado)
- Pontualidade queixo: ${metrics.chinPoint} (> 0.28 = pontudo/coração)
- Afunilamento testa→mandíbula: ${pct(metrics.taperForeJaw)}
- Afunilamento mandíbula→queixo: ${pct(metrics.taperJawChin)}

Retorne SOMENTE JSON válido sem markdown:
{
  "formato": "nome_em_snake_case",
  "label": "Nome em português",
  "confianca": "alta|media|baixa",
  "regiao_dominante": "superior|macas|inferior|equilibrado",
  "justificativa": "2-3 frases explicando a classificação com base nas métricas e no contorno visual",
  "metricas_decisivas": ["métrica 1", "métrica 2"]
}`;

    const apiKey = process.env.GEMINI_API_KEY;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const body = {
      contents: [{
        parts: [
          { text: prompt },
          { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } }
        ]
      }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 600
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(500).json({ error: 'Gemini API error', detail: err, status: response.status });
    }

    const data = await response.json();
    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const clean = raw.replace(/```json|```/g, '').trim();
    const result = JSON.parse(clean);
    return res.status(200).json(result);

  } catch(e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
