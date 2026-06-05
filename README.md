# Identificador de Formato de Rosto

## API gratuita — Google Gemini
Este projeto usa o **Google Gemini 1.5 Flash** — gratuito até 1.500 requisições/dia.

## Como obter a chave gratuita do Gemini

1. Acesse **aistudio.google.com**
2. Faça login com sua conta Google
3. Clique em **"Get API Key"** → **"Create API key"**
4. Copie a chave gerada (começa com `AIza...`)
5. **Não tem custo** — o plano gratuito permite 1.500 análises por dia

## Deploy no Vercel

### 1. Configure a variável de ambiente
No Vercel dashboard → **Settings → Environment Variables**:
- **Nome:** `GEMINI_API_KEY`
- **Valor:** sua chave do Gemini (começa com `AIza...`)

### 2. Estrutura do projeto
```
visagismo-app/
├── index.html        ← Frontend completo
├── api/
│   └── analyze.js    ← Função Vercel (chama Gemini)
├── vercel.json       ← Configuração do Vercel
└── package.json
```

### 3. Como funciona
1. Usuário faz upload da foto
2. MediaPipe detecta 478 pontos faciais no navegador
3. O contorno é desenhado e as métricas calculadas
4. A imagem + métricas são enviadas para `/api/analyze`
5. A função chama a API do Gemini com visão
6. O resultado volta para o frontend com o formato identificado
