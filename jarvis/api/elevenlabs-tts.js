// api/elevenlabs-tts.js — proxy seguro para voz ElevenLabs
// Configure na Vercel:
// ELEVENLABS_API_KEY = sua chave ElevenLabs
// ELEVENLABS_VOICE_ID = ID da voz escolhida (opcional; usa uma voz padrão se não definir)

const DEFAULT_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb';
const DEFAULT_MODEL_ID = 'eleven_multilingual_v2';

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
    const { text, voiceId, modelId } = req.body || {};
    const cleanText = String(text || '').trim();

    if (!cleanText) {
      res.status(400).json({ error: 'Campo "text" ausente ou inválido.' });
      return;
    }

    const safeText = cleanText.slice(0, 2400);
    const selectedVoice = String(voiceId || process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID).trim();
    const selectedModel = String(modelId || process.env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL_ID).trim();

    const upstream = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(selectedVoice)}/stream?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': apiKey,
          'Accept': 'audio/mpeg'
        },
        body: JSON.stringify({
          text: safeText,
          model_id: selectedModel,
          voice_settings: {
            stability: 0.48,
            similarity_boost: 0.82,
            style: 0.28,
            use_speaker_boost: true
          }
        })
      }
    );

    if (!upstream.ok) {
      const err = await upstream.text().catch(() => '');
      res.status(upstream.status).json({ error: err || 'Erro na API ElevenLabs.' });
      return;
    }

    const audioBuffer = Buffer.from(await upstream.arrayBuffer());
    res.setHeader('Content-Type', upstream.headers.get('content-type') || 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).send(audioBuffer);
  } catch (err) {
    res.status(500).json({ error: 'Erro interno no proxy ElevenLabs: ' + err.message });
  }
};
