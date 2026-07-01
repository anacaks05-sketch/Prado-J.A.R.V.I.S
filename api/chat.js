// api/chat.js — Vercel Serverless Function
// Faz proxy das mensagens do Jarvis para a API da Anthropic, mantendo a chave no servidor.
// Configure a variável de ambiente ANTHROPIC_API_KEY no painel da Vercel.

const SYSTEM_PROMPT = `Você é J.A.R.V.I.S., o assistente pessoal de voz do usuário — direto, eficiente,
levemente espirituoso, no estilo do assistente de Tony Stark. Responda sempre em português do Brasil.
Suas respostas serão faladas em voz alta por um sintetizador de voz, então:
- Seja conciso (normalmente 1 a 3 frases, salvo se o usuário pedir detalhes).
- Não use markdown, listas com marcadores, emojis ou formatação — apenas texto corrido natural para fala.
- Trate o usuário com um tom respeitoso e confiante, como um assistente de elite trataria seu comandante.
- Se não souber algo com certeza ou precisar de dados em tempo real que você não tem, diga isso claramente
  em vez de inventar informações.`;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'ANTHROPIC_API_KEY não configurada no servidor.' });
    return;
  }

  try {
    const { messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'Campo "messages" ausente ou inválido.' });
      return;
    }

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 600,
        system: SYSTEM_PROMPT,
        messages: messages.map(m => ({ role: m.role, content: m.content })),
      }),
    });

    const data = await upstream.json();

    if (!upstream.ok) {
      res.status(upstream.status).json({ error: data.error?.message || 'Erro na API da Anthropic' });
      return;
    }

    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: 'Erro interno no proxy: ' + err.message });
  }
};
