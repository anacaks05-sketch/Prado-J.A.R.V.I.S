# J.A.R.V.I.S. — PWA de assistente pessoal com voz premium

HUD futurista estilo Homem de Ferro com núcleo animado, figura holográfica premium, reconhecimento de voz em pt-BR, resposta por voz ElevenLabs com análise real do áudio reproduzido, chat com IA via proxy serverless, comandos locais rápidos, abertura de rascunho no Gmail e app instalável como PWA.

## O que entrou nesta versão

- **Voz ElevenLabs** via proxy seguro `/api/elevenlabs-tts.js`.
- **Análise de áudio real na fala do Jarvis**: o áudio MP3 gerado pela ElevenLabs é reproduzido no navegador e passa por `AudioContext + AnalyserNode`, então o núcleo, barras e telemetria reagem à voz de verdade. Se a ElevenLabs não estiver configurada, cai automaticamente para a voz nativa do navegador.
- **Gmail**: comandos como “abrir Gmail” ou “enviar email para exemplo@email.com assunto teste mensagem olá” abrem um rascunho no Gmail para revisar e enviar.
- **Figura holográfica refeita do zero**: armadura/holograma com capacete, torso, painéis, aura, linhas de dados e base holográfica; saiu do modelo “bonequinho de palito”.
- **Cache PWA atualizado** para forçar o celular a pegar a nova versão.

## Estrutura

```
jarvis/
├── index.html
├── manifest.json
├── sw.js
├── css/
│   └── style.css
├── js/
│   ├── reactor.js
│   ├── globe.js
│   ├── radar.js
│   ├── voice.js
│   ├── commands.js
│   ├── chat.js
│   └── app.js
├── api/
│   ├── chat.js
│   └── elevenlabs-tts.js
└── icons/
    ├── icon-192.png
    └── icon-512.png
```

## Deploy na Vercel

1. Suba a pasta `jarvis` para o GitHub.
2. Importe o repositório na Vercel.
3. Em **Settings → Environment Variables**, adicione:
   - `ANTHROPIC_API_KEY` = sua chave da Anthropic.
   - `ELEVENLABS_API_KEY` = sua chave da ElevenLabs.
   - `ELEVENLABS_VOICE_ID` = ID da voz escolhida na ElevenLabs. Opcional, mas recomendado.
   - `ELEVENLABS_MODEL_ID` = opcional. Padrão: `eleven_multilingual_v2`.
4. Faça o redeploy.
5. Abra no celular e instale pela tela de início.

## Comandos locais

- “Que horas são?”
- “Que dia é hoje?”
- “Calcule 45 * 12”
- “Lembre-me de ligar pro cliente amanhã”
- “Meus lembretes”
- “Limpar lembretes”
- “Limpar histórico”
- “Abrir Gmail”
- “Enviar email para cliente@email.com assunto Reunião mensagem Confirmo nossa reunião amanhã.”

Qualquer frase fora dos comandos locais vai para a IA em `/api/chat`.

## Observações importantes

- A chave da ElevenLabs fica só no servidor da Vercel, nunca no JavaScript do app.
- O app não envia e-mail sozinho; ele abre o rascunho no Gmail para você revisar e tocar em enviar. Isso evita precisar de OAuth completo ou senha do Gmail dentro do app.
- No iPhone, depois do deploy, feche o app instalado e abra de novo para o novo service worker atualizar o cache.
