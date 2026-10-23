(function () {
  var CFG = window.HP_CONFIG || {};
  var form = document.getElementById('form');
  var msg = document.getElementById('msg');
  var send = document.getElementById('send');

  function show(text, kind) {
    msg.textContent = text;
    msg.className = 'msg ' + (kind || '');
  }

  function chosen(name) {
    var el = form.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : '';
  }

  function validPhone(value) {
    if (!value) return true;
    var digits = value.replace(/\D/g, '');
    return /^[0-9+()./ -]{6,40}$/.test(value) && digits.length >= 6;
  }

  form.addEventListener('submit', function (event) {
    event.preventDefault();
    if (send.disabled) return;
    var name = form.name.value.trim();
    var email = form.email.value.trim();
    var phone = form.phone.value.trim();
    var note = form.note.value.trim();
    if (name.length < 1 || name.length > 80 || /[<>]/.test(name)) {
      show('Bitte einen Namen ohne Sonderzeichen eintragen.', 'err');
      return;
    }
    if (!/^[^\s@]{1,64}@[^\s@]{1,80}\.[^\s@]{2,24}$/.test(email) || email.length > 120) {
      show('Bitte eine gültige E-Mail-Adresse eintragen.', 'err');
      return;
    }
    if (!validPhone(phone)) {
      show('Die Telefonnummer bitte mit Landesvorwahl oder als übliche Nummer, oder das Feld leer lassen.', 'err');
      return;
    }
    if (!chosen('arrive') || !chosen('stay') || !chosen('milonga') || !chosen('dinner')) {
      show('Bitte bei jeder Frage eine Antwort wählen.', 'err');
      return;
    }
    if (note.length > 400) {
      show('Die Anmerkung ist zu lang.', 'err');
      return;
    }
    if (!CFG.supabaseUrl || !CFG.supabaseAnonKey) {
      show('Das Formular ist gerade nicht verbunden.', 'err');
      return;
    }
    send.disabled = true;
    show('Wird geschickt …', '');
    fetch(CFG.supabaseUrl + '/functions/v1/hp-offer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: CFG.supabaseAnonKey,
        Authorization: 'Bearer ' + CFG.supabaseAnonKey
      },
      body: JSON.stringify({
        name: name,
        email: email,
        phone: phone,
        arrive: chosen('arrive'),
        stay: chosen('stay'),
        milonga: chosen('milonga'),
        dinner: chosen('dinner'),
        note: note,
        company: form.company.value
      })
    }).then(function (res) {
      return res.json().then(function (data) { return { status: res.status, data: data }; }, function () { return { status: res.status, data: null }; });
    }).then(function (res) {
      send.disabled = false;
      if (res.status === 200 && res.data && res.data.ok) {
        form.hidden = true;
        show('Danke. Wir haben deine Rückmeldung. Wenn sich etwas ändert, schick das Formular mit derselben E-Mail-Adresse einfach noch einmal.', 'ok');
        return;
      }
      if (res.status === 429) {
        show('Gerade kommen viele Rückmeldungen an. Bitte in ein paar Minuten noch einmal.', 'err');
        return;
      }
      show('Das hat nicht geklappt. Bitte die Angaben prüfen und noch einmal schicken.', 'err');
    }, function () {
      send.disabled = false;
      show('Keine Verbindung. Bitte später noch einmal schicken.', 'err');
    });
  });
})();
