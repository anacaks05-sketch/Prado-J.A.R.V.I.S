/* commands.js — comandos locais rápidos (sem round-trip à IA) */
(function(){

  function getReminders(){
    try{ return JSON.parse(localStorage.getItem('jarvis_reminders') || '[]'); }
    catch(e){ return []; }
  }
  function saveReminders(list){
    localStorage.setItem('jarvis_reminders', JSON.stringify(list));
  }

  function formatTime(){
    return new Date().toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'});
  }
  function formatDate(){
    return new Date().toLocaleDateString('pt-BR', {weekday:'long', day:'2-digit', month:'long', year:'numeric'});
  }

  function buildGmailComposeUrl({to='', subject='', body=''} = {}){
    const params = new URLSearchParams({ view:'cm', fs:'1' });
    if(to) params.set('to', to);
    if(subject) params.set('su', subject);
    if(body) params.set('body', body);
    return 'https://mail.google.com/mail/?' + params.toString();
  }

  function extractBetween(raw, startWords, endWords){
    const lower = raw.toLowerCase();
    let start = -1;
    let startLen = 0;
    for(const w of startWords){
      const idx = lower.indexOf(w);
      if(idx !== -1 && (start === -1 || idx < start)){
        start = idx;
        startLen = w.length;
      }
    }
    if(start === -1) return '';
    let end = raw.length;
    for(const w of endWords){
      const idx = lower.indexOf(w, start + startLen);
      if(idx !== -1 && idx < end) end = idx;
    }
    return raw.slice(start + startLen, end).replace(/^[:\s,.-]+|[:\s,.-]+$/g, '').trim();
  }

  function parseGmailCommand(rawText){
    const raw = rawText.trim();
    const text = raw.toLowerCase();

    if(/^(abrir|abra|abre)\s+(meu\s+)?(gmail|e-mail|email|caixa de entrada)/.test(text)){
      return {
        type: 'open_url',
        url: 'https://mail.google.com/mail/u/0/#inbox',
        label: 'Abrir Gmail',
        speak: 'Abrindo o Gmail agora.'
      };
    }

    const looksLikeEmailCommand = /(gmail|e-mail|email)/.test(text) && /(enviar|mande|mandar|criar|escrever|preparar|redigir|compor)/.test(text);
    if(!looksLikeEmailCommand) return null;

    const emailMatch = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    const toByEmail = emailMatch ? emailMatch[0] : '';
    let toByText = extractBetween(raw, [' para ', ' pra '], [' assunto ', ' assunto:', ' com assunto ', ' mensagem ', ' mensagem:', ' dizendo ', ' falando ', ' corpo ', ' corpo:']);
    if(toByEmail && toByText.includes(toByEmail)) toByText = toByEmail;

    const subject = extractBetween(raw, [' assunto ', ' assunto:', ' com assunto ', ' título ', ' titulo ', ' título:', ' titulo:'], [' mensagem ', ' mensagem:', ' dizendo ', ' corpo ', ' corpo:']);
    const body = extractBetween(raw, [' mensagem ', ' mensagem:', ' dizendo ', ' corpo ', ' corpo:', ' texto ', ' texto:'], []);

    const to = toByEmail || (/^[^@]{2,80}$/.test(toByText) ? '' : toByText);
    const finalBody = body || (subject ? '' : raw.replace(/^(enviar|mande|mandar|criar|escrever|preparar|redigir|compor)\s+(um\s+)?(gmail|e-mail|email)\s*/i, '').trim());

    return {
      type: 'gmail_compose',
      url: buildGmailComposeUrl({ to, subject, body: finalBody }),
      label: 'Abrir rascunho no Gmail',
      speak: to ? 'Rascunho do Gmail preparado. Vou abrir para você revisar e enviar.' : 'Rascunho do Gmail preparado. Complete o destinatário, revise e envie.'
    };
  }

  // Tenta resolver localmente. Retorna string, ação local ou null se não reconhecido
  // (nesse caso, o texto segue para a IA).
  function tryLocal(rawText){
    const text = rawText.toLowerCase().trim();

    const gmailAction = parseGmailCommand(rawText);
    if(gmailAction) return gmailAction;

    if(/^(que horas s[ãa]o|horas agora|hor[áa]rio atual)/.test(text)){
      return `São ${formatTime()}.`;
    }

    if(/(que dia [ée]|data de hoje|qual a data)/.test(text)){
      return `Hoje é ${formatDate()}.`;
    }

    const calcMatch = text.match(/^(calcul[ae]|quanto [ée])\s+(.+)/) || text.match(/^([\d\s+\-*/().,]+)$/);
    if(calcMatch){
      const expr = (calcMatch[2] || calcMatch[1]).replace(/vezes/g,'*').replace(/mais/g,'+').replace(/menos/g,'-').replace(/dividido por/g,'/').replace(',', '.');
      if(/^[\d\s+\-*/().]+$/.test(expr)){
        try{
          // eslint-disable-next-line no-new-func
          const result = Function(`"use strict"; return (${expr})`)();
          if(typeof result === 'number' && isFinite(result)){
            return `O resultado é ${result}.`;
          }
        }catch(e){ /* segue pra IA */ }
      }
    }

    const remindMatch = text.match(/^(lembr(e|a)(-me)? de|criar lembrete[:]?|adicionar lembrete[:]?)\s+(.+)/);
    if(remindMatch){
      const content = remindMatch[4].trim();
      const list = getReminders();
      list.push({ id: Date.now(), text: content, createdAt: new Date().toISOString(), done:false });
      saveReminders(list);
      return `Lembrete adicionado: "${content}".`;
    }

    if(/^(meus lembretes|listar lembretes|quais s[ãa]o meus lembretes)/.test(text)){
      const list = getReminders().filter(r=>!r.done);
      if(list.length === 0) return 'Você não tem lembretes pendentes.';
      return 'Seus lembretes: ' + list.map(r=>r.text).join('; ') + '.';
    }

    if(/^(limpar lembretes|apagar lembretes)/.test(text)){
      saveReminders([]);
      return 'Lembretes apagados.';
    }

    if(/^(limpar (o )?hist[oó]rico|apagar conversa)/.test(text)){
      return '__CLEAR_TRANSCRIPT__';
    }

    return null;
  }

  window.Commands = { tryLocal, getReminders, saveReminders, buildGmailComposeUrl };
})();
