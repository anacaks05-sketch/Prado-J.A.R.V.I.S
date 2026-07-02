// api/elevenlabs-stt.js — proxy seguro para transcrição de voz ElevenLabs
// Configure na Vercel:
// ELEVENLABS_API_KEY = sua chave ElevenLabs
// A chave precisa ter acesso ao endpoint "Fala para Texto" / Speech to Text.

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Método não permitido' });
    return;
  }

  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'ELEVENLABS_API_KEY não configurada no servidor.' });
    return;
  }

  try {
    const { audioBase64, mimeType, fileName, languageCode } = req.body || {};

    if (!audioBase64) {
      res.status(400).json({ error: 'audioBase64 ausente.' });
      return;
    }

    const base64 = String(audioBase64).includes(',')
      ? String(audioBase64).split(',').pop()
      : String(audioBase64);

    const audioBuffer = Buffer.from(base64, 'base64');

    if (!audioBuffer || audioBuffer.length < 800) {
      res.status(400).json({ error: 'Áudio muito curto ou vazio.' });
      return;
    }

    const form = new FormData();
    const type = String(mimeType || 'audio/webm');
    const name = String(fileName || (type.includes('mp4') ? 'audio.mp4' : 'audio.webm'));

    form.append('model_id', process.env.ELEVENLABS_STT_MODEL_ID || 'scribe_v2');
    form.append('language_code', languageCode || 'pt');
    form.append('tag_audio_events', 'false');
    form.append('timestamps_granularity', 'none');
    form.append('file', new Blob([audioBuffer], { type }), name);

    const upstream = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey
      },
      body: form
    });

    const raw = await upstream.text();

    if (!upstream.ok) {
      let parsed = {};
      try { parsed = JSON.parse(raw); } catch (e) {}

      const detail = parsed.detail || parsed;
      const msg = typeof detail === 'object' ? JSON.stringify(detail) : String(detail || raw || '');

      if (msg.includes('missing_permissions') || msg.includes('speech_to_text')) {
        res.status(403).json({
          code: 'ELEVENLABS_STT_PERMISSION',
          error: 'Sua chave ElevenLabs está sem permissão de Fala para Texto / Speech to Text. Ative Speech to Text na chave da ElevenLabs ou crie uma nova chave com esse acesso.'
        });
        return;
      }

      res.status(upstream.status).json({
        error: raw || 'Erro na API ElevenLabs Speech to Text.'
      });
      return;
    }

    let data = {};
    try { data = JSON.parse(raw); } catch (e) {}

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      text: String(data.text || '').trim(),
      language_code: data.language_code || null,
      language_probability: data.language_probability || null
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro interno no proxy Speech to Text: ' + err.message });
  }
};
