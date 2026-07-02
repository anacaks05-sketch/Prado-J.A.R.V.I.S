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


  const WHATSAPP_CONTACTS_KEY = 'jarvis_whatsapp_contacts';

  function getWhatsAppContacts(){
    try{ return JSON.parse(localStorage.getItem(WHATSAPP_CONTACTS_KEY) || '{}'); }
    catch(e){ return {}; }
  }

  function saveWhatsAppContacts(map){
    localStorage.setItem(WHATSAPP_CONTACTS_KEY, JSON.stringify(map || {}));
  }

  function normalizeContactName(name){
    return String(name || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ');
  }

  function normalizeBrazilPhone(raw){
    let digits = String(raw || '').replace(/\D+/g, '');

    // Se o usuário passar telefone BR sem código do país, adiciona 55.
    // Ex.: 11999999999 => 5511999999999
    if((digits.length === 10 || digits.length === 11) && !digits.startsWith('55')){
      digits = '55' + digits;
    }

    return digits;
  }

  function buildWhatsAppUrls({phone='', message=''} = {}){
    const digits = normalizeBrazilPhone(phone);
    const encoded = encodeURIComponent(message || '');

    if(digits){
      return {
        url: 'https://api.whatsapp.com/send?phone=' + digits + (encoded ? '&text=' + encoded : ''),
        webUrl: 'https://wa.me/' + digits + (encoded ? '?text=' + encoded : ''),
        mobileUrl: 'whatsapp://send?phone=' + digits + (encoded ? '&text=' + encoded : '')
      };
    }

    return {
      url: encoded ? 'https://wa.me/?text=' + encoded : 'https://web.whatsapp.com/',
      webUrl: encoded ? 'https://wa.me/?text=' + encoded : 'https://web.whatsapp.com/',
      mobileUrl: encoded ? 'whatsapp://send?text=' + encoded : 'whatsapp://send'
    };
  }

  function buildWhatsAppUrl(opts){
    return buildWhatsAppUrls(opts).url;
  }

  function extractMessageAfter(raw, markers){
    const lower = raw.toLowerCase();
    let best = -1, bestLen = 0;
    for(const m of markers){
      const idx = lower.indexOf(m);
      if(idx !== -1 && (best === -1 || idx < best)){
        best = idx;
        bestLen = m.length;
      }
    }
    if(best === -1) return '';
    return raw.slice(best + bestLen).replace(/^[:\s,.-]+|[:\s,.-]+$/g, '').trim();
  }

  function parseWhatsAppCommand(rawText){
    const raw = rawText.trim();
    const text = raw.toLowerCase();

    if(/^(abrir|abra|abre)\s+(meu\s+)?(whatsapp|zap|zapzap|zape)/.test(text)){
      return {
        type: 'whatsapp_open',
        ...buildWhatsAppUrls(),
        label: 'Abrir WhatsApp',
        speak: 'Abrindo o WhatsApp agora.'
      };
    }

    // Salvar contato WhatsApp João 11999999999
    // Salvar contato do zap Maria 75999999999
    const saveMatch = raw.match(/^(salvar|guardar|cadastrar)\s+(contato\s+)?(do\s+)?(whatsapp|zap|zapzap|zape)\s+(.+?)\s+(\+?\d[\d\s().-]{7,})$/i);
    if(saveMatch){
      const name = saveMatch[5].trim();
      const phone = normalizeBrazilPhone(saveMatch[6]);
      if(!phone || phone.length < 11){
        return 'Não consegui entender o número. Me diga com DDD, por exemplo: salvar contato WhatsApp João 11999999999.';
      }
      const contacts = getWhatsAppContacts();
      contacts[normalizeContactName(name)] = { name, phone };
      saveWhatsAppContacts(contacts);
      return `Contato de WhatsApp salvo: ${name}.`;
    }

    if(/^(listar|mostrar|ver)\s+(contatos\s+)?(do\s+)?(whatsapp|zap)/.test(text)){
      const contacts = Object.values(getWhatsAppContacts());
      if(!contacts.length) return 'Você ainda não tem contatos de WhatsApp salvos no Jarvis.';
      return 'Contatos de WhatsApp salvos: ' + contacts.map(c => `${c.name}`).join(', ') + '.';
    }

    const delMatch = raw.match(/^(apagar|remover|excluir)\s+(contato\s+)?(do\s+)?(whatsapp|zap)\s+(.+)$/i);
    if(delMatch){
      const name = delMatch[5].trim();
      const key = normalizeContactName(name);
      const contacts = getWhatsAppContacts();
      if(!contacts[key]) return `Não encontrei o contato ${name} no WhatsApp do Jarvis.`;
      delete contacts[key];
      saveWhatsAppContacts(contacts);
      return `Contato ${name} removido do WhatsApp do Jarvis.`;
    }

    const looksLikeWhatsApp = /(whatsapp|zap|zapzap|zape)/.test(text) &&
      /(mandar|mande|enviar|envie|responder|responda|chamar|chame|escrever|preparar)/.test(text);

    if(!looksLikeWhatsApp) return null;

    const message = extractMessageAfter(raw, [
      ' mensagem ', ' mensagem:', ' dizendo ', ' falar ', ' falando ',
      ' texto ', ' texto:', ' com a mensagem ', ' com texto '
    ]);

    const phoneMatch = raw.match(/(\+?\d[\d\s().-]{7,})/);
    let phone = phoneMatch ? normalizeBrazilPhone(phoneMatch[1]) : '';

    let toName = extractBetween(raw, [' para ', ' pra ', ' ao ', ' a '], [
      ' mensagem ', ' mensagem:', ' dizendo ', ' falar ', ' falando ',
      ' texto ', ' texto:', ' com a mensagem ', ' com texto '
    ]);

    if(phone && toName.includes(phoneMatch[1])) toName = '';

    if(!phone && toName){
      const contacts = getWhatsAppContacts();
      const saved = contacts[normalizeContactName(toName)];
      if(saved) phone = saved.phone;
    }

    const finalMessage = message || raw
      .replace(/^(mandar|mande|enviar|envie|responder|responda|chamar|chame|escrever|preparar)\s+(um\s+)?(whatsapp|zap|zapzap|zape)\s*/i, '')
      .replace(/^(para|pra)\s+/i, '')
      .trim();

    if(!phone && toName){
      return {
        type: 'whatsapp_missing_phone',
        ...buildWhatsAppUrls({message: finalMessage}),
        label: 'Abrir WhatsApp',
        speak: `Não tenho o número de ${toName} salvo. Vou abrir o WhatsApp com a mensagem pronta. Para mandar por nome depois, diga: salvar contato WhatsApp ${toName} número com DDD.`
      };
    }

    if(!phone){
      return {
        type: 'whatsapp_share',
        ...buildWhatsAppUrls({message: finalMessage}),
        label: 'Abrir WhatsApp com mensagem',
        speak: 'Preparei a mensagem. Vou abrir o WhatsApp para você escolher a conversa e enviar.'
      };
    }

    return {
      type: 'whatsapp_compose',
      ...buildWhatsAppUrls({ phone, message: finalMessage }),
      label: 'Abrir mensagem no WhatsApp',
      speak: 'Mensagem do WhatsApp preparada. Revise e aperte enviar.'
    };
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

    const whatsappAction = parseWhatsAppCommand(rawText);
    if(whatsappAction) return whatsappAction;

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

  window.Commands = { tryLocal, getReminders, saveReminders, buildGmailComposeUrl, buildWhatsAppUrl, buildWhatsAppUrls, getWhatsAppContacts, saveWhatsAppContacts };
})();
