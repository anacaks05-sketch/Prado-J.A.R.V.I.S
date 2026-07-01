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

  // Tenta resolver localmente. Retorna string de resposta ou null se não reconhecido
  // (nesse caso, o texto segue para a IA).
  function tryLocal(rawText){
    const text = rawText.toLowerCase().trim();

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

  window.Commands = { tryLocal, getReminders, saveReminders };
})();
