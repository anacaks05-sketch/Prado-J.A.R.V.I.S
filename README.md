
## Atualização V4.3 — WhatsApp

Comandos adicionados:

- `Abrir WhatsApp`
- `Mandar WhatsApp para 11999999999 mensagem Oi, tudo bem?`
- `Responder WhatsApp para 11999999999 mensagem Já te retorno.`
- `Salvar contato WhatsApp João 11999999999`
- `Mandar WhatsApp para João mensagem Cheguei em casa.`
- `Listar contatos WhatsApp`
- `Apagar contato WhatsApp João`

Observação: por segurança, esta versão abre o WhatsApp com a mensagem pronta para revisão. Envio automático sem confirmação exige integração oficial com WhatsApp Business Cloud API.


## Correção V4.2 — Microfone

- Botão do microfone ficou visível e clicável.
- O navegador agora força a solicitação de permissão do microfone.
- Mensagens de erro aparecem na tela quando o microfone estiver bloqueado.
- Se o navegador não suportar reconhecimento de voz, use o campo de texto.

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


## Holograma Premium V2

Esta versão troca o boneco simples por um avatar holográfico mais premium, com silhueta humanoide, armadura translúcida, núcleo ARC, visor iluminado, linhas HUD e plataforma animada.


## Versão Final Aprovada V3

Esta versão usa o modelo visual aprovado do J.A.R.V.I.S. com holograma humanoide premium, núcleo no peito, HUD futurista e painel refinado.

Mantido nesta versão:
- Voz ElevenLabs via proxy seguro `/api/elevenlabs-tts.js`
- Fallback para voz nativa do navegador se a chave não estiver configurada
- Análise visual de áudio para reação do núcleo/interface
- Comandos de Gmail abrindo rascunho pronto para revisar e enviar
- PWA com manifest, service worker e ícones

Variáveis necessárias na Vercel:

```txt
ANTHROPIC_API_KEY=sua_chave_da_ia
ELEVENLABS_API_KEY=sua_chave_da_elevenlabs
ELEVENLABS_VOICE_ID=id_da_voz_escolhida
```
