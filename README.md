# J.A.R.V.I.S. — PWA de assistente pessoal com voz

HUD futurista estilo Homem de Ferro: núcleo animado (canvas), reconhecimento
de voz e síntese em pt-BR, chat com IA (Claude) via proxy serverless, comandos
locais rápidos (hora, data, cálculo, lembretes) e app instalável (PWA).

## Estrutura

```
jarvis/
├── index.html          # HUD principal
├── manifest.json        # PWA manifest
├── sw.js                 # Service worker (cache offline do app shell)
├── css/style.css         # Tema visual (cyan/HUD)
├── js/
│   ├── reactor.js        # Núcleo animado (canvas) — idle/listening/thinking/speaking
│   ├── voice.js           # SpeechRecognition + SpeechSynthesis (pt-BR)
│   ├── commands.js        # Comandos locais (hora, data, cálculo, lembretes)
│   ├── chat.js             # Fala com /api/chat
│   └── app.js               # Orquestra tudo
├── api/
│   └── chat.js              # Função serverless (Vercel) — proxy seguro pra Anthropic API
└── icons/                    # Ícones do PWA
```

## Deploy na Vercel (recomendado, igual seus outros projetos)

1. Suba a pasta pra um repositório no GitHub.
2. Importe o repo na Vercel.
3. Em **Settings → Environment Variables**, adicione:
   - `ANTHROPIC_API_KEY` = sua chave da API da Anthropic
4. Deploy. A Vercel detecta `api/chat.js` automaticamente como Serverless Function.
5. Acesse pelo celular e use "Adicionar à tela de início" pra instalar como app.

Não precisa de nenhuma outra configuração — o front-end já chama `/api/chat`
relativo ao próprio domínio, então funciona direto após o deploy.

## Rodando local

Como usa `fetch('/api/chat')`, você precisa de um servidor que rode a função
serverless. Duas opções fáceis:

```bash
npm i -g vercel
vercel dev
```

Isso sobe o front-end e a função `/api/chat` juntos em `localhost:3000`,
lendo `ANTHROPIC_API_KEY` de um arquivo `.env` local (`.env.local`).

## Comandos de voz/texto já reconhecidos localmente (sem gastar tokens de IA)

- "Que horas são?"
- "Que dia é hoje?"
- "Calcule 45 * 12" / "quanto é 200 / 5"
- "Lembre-me de ligar pro cliente amanhã" → salva lembrete (localStorage)
- "Meus lembretes" → lista os pendentes
- "Limpar lembretes"
- "Limpar histórico" → limpa a conversa na tela e o contexto da IA

Qualquer outra frase é enviada para a IA (via `/api/chat`), que responde em
texto curto pensado pra ser falado em voz alta.

## Customizações fáceis

- **Tom da IA / personalidade**: edite `SYSTEM_PROMPT` em `api/chat.js`.
- **Voz**: `js/voice.js` tenta escolher uma voz pt-BR masculina automaticamente
  (varia por navegador/SO — no Chrome Android costuma ter mais opções que no
  Safari iOS).
- **Cores do HUD**: variáveis CSS no topo de `css/style.css` (`--cyan`, `--amber`, etc).
- **Ícones**: substitua os PNGs em `icons/` pelos seus, mantendo os tamanhos
  192x192 e 512x512.

## Próximos passos sugeridos

- Integração com o bot do Telegram "Prado Sinais" pra centralizar comandos.
- Web search real (a API da Anthropic suporta a tool de busca web — dá pra
  ligar isso em `api/chat.js` se quiser respostas com dados atualizados).
- Wake word ("Ei, Jarvis") usando um modelo leve tipo Porcupine, já que
  SpeechRecognition do navegador não escuta em background contínuo.
