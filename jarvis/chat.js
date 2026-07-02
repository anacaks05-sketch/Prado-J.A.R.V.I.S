/* chat.js — comunica com o backend serverless (api/chat.js) que fala com a Claude API */
(function(){
  const ENDPOINT = '/api/chat';
  const HISTORY_KEY = 'jarvis_history';
  const MAX_HISTORY = 16;

  function getHistory(){
    try{ return JSON.parse(sessionStorage.getItem(HISTORY_KEY) || '[]'); }
    catch(e){ return []; }
  }
  function saveHistory(list){
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(-MAX_HISTORY)));
  }
  function clearHistory(){
    sessionStorage.removeItem(HISTORY_KEY);
  }

  async function ask(userText){
    const history = getHistory();
    history.push({ role:'user', content:userText });

    const started = performance.now();
    const res = await fetch(ENDPOINT, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ messages: history })
    });

    if(!res.ok){
      const err = await res.text().catch(()=> '');
      throw new Error(`Falha na API (${res.status}): ${err || 'sem detalhes'}`);
    }

    const data = await res.json();
    const latency = Math.round(performance.now() - started);
    const reply = (data.content || [])
      .filter(b => b.type === 'text')
      .map(b => b.text)
      .join('\n')
      .trim() || 'Não obtive uma resposta clara.';

    history.push({ role:'assistant', content: reply });
    saveHistory(history);

    return { reply, latency };
  }

  window.Chat = { ask, clearHistory, getHistory };
})();
