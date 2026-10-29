/* Bendito Helferplan 5.1.0
 *
 * Preact + htm ohne Build-Schritt. Alle Fachdaten liegen in der Datenbank und
 * kommen über hp_state(); geändert wird nur über die hp_-Funktionen. Im Browser
 * bleiben die Sitzung und zwei Anzeige-Vorlieben, sonst nichts.
 */
(function () {
  'use strict';

  var Ph = preact.h, Pr = preact.render;
  var useState = preactHooks.useState, useMemo = preactHooks.useMemo,
      useEffect = preactHooks.useEffect, useLayoutEffect = preactHooks.useLayoutEffect,
      useRef = preactHooks.useRef;
  var html = htm.bind(Ph);

  var CFG = window.HP_CONFIG || {};
  var VERSION = CFG.version || '';
  var POLL_MS = 20000;
  var RPC_TIMEOUT_MS = 8000;
  var LOGO = 'assets/logo.png';
  var BENDITO_APP = CFG.benditoAppUrl;

  // ===== Feste Texte. Nur diese Konstanten gelangen in dangerouslySetInnerHTML. =====
  var ST = {
    einkauf: {n: 'Einkauf', info: 'Einkäufe für das Marathon-Wochenende erledigen. Liste mit der Orga absprechen.'},
    aufbau: {n: 'Aufbau', info: 'Aufbau Donnerstag + Freitag: Bendito Banner aufhängen, rote Tischdecken auf kleine Tische, Tische dekorieren, Geschirr-Rückgabe vor dem Raum im Flur einrichten.'},
    helferessen: {n: 'Helferessen', info: 'Helferessen 19:30 Uhr. Tisch decken im Milongasaal, Getränke bereitstellen, nach dem Essen Geschirr abräumen, Reste in die Helferküche bringen.'},
    'fr-aufbau': {n: 'Freitag Aufbau', info: 'Freitag Aufbau: Saal vorbereiten, Kerzen und Blumen aufstellen, Beschilderung anbringen, Bar aufbauen im Buffet-Raum. Kühlschrank steht neben der Bar, Vorrat-Kisten unter dem Bartisch.'},
    team: {n: 'Teamtreffen', info: 'Freitag, 30.10.2026, um 15:00 Uhr: gemeinsamer Start ins Jubiläumswochenende! Bitte komm, wenn es dir möglich ist – wir möchten uns als Team kennenlernen und die letzten Fragen klären. Wenn du nicht dabei sein kannst, gib der Orga bitte kurz Bescheid. Lies in jedem Fall die Infos unter „Anleitungen“ gut durch: Dort stehen die Grundlagen für deine Mithilfe.'},
    checkin: {n: 'Check-In', info: 'Gäste empfangen, Namenslisten prüfen, Bändchen ausgeben. Stempelkarten Verkauf! Ab 20:30 Uhr Check-In an die Bar übergeben.'},
    sekt: {n: 'Sektempfang', info: 'Aufbau Sektempfang. Gläser bereitstellen, Sekt kühlen, Empfangsbereich dekorieren.'},
    bettw: {n: 'Bettwäsche', info: 'Bettwäsche hochbringen in die Schlafräume und verteilen.'},
    bar: {n: 'Bar', info: '1 Bar-Schicht = 1,5h. Getränke ausschenken, Nachschub aus dem Lager holen (Vorrat-Kisten unter Bartisch), Spülstation prüfen (saubere Gläser?), Kühlschränke kontrollieren. Bar von 21–22:30 geschlossen (Konzert)! Leergut einsammeln und sortieren.'},
    konzert: {n: 'Konzert/Kerzen', info: 'Konzertsaal vorbereiten, Kerzen aufstellen und anzünden, Wachsreste entfernen, nach dem Konzert aufräumen.'},
    brunch: {n: 'Brunch-Service', info: 'Vorbereitung Brunch mit dem Küchenteam. Service während des Brunchs, Buffet auffüllen, Geschirr abräumen.'},
    kuchen: {n: 'Kuchen', info: 'Kuchen anrichten und servieren, Kaffee/Tee bereitstellen (Ikea-Einkauf: Servietten, Teelichter).'},
    dinner: {n: 'Dinner-Service', info: 'Dinner-Service: Tische eindecken, Essen servieren, Getränke nachschenken, nach dem Dinner abräumen.'},
    kueche: {n: 'Küche', info: 'Küchenarbeit: 13:00 Helferküche putzen, Vorbereitung für Mahlzeiten, Spülmaschine bedienen.'},
    spuelen: {n: 'Spülen', info: 'Alles muss gespült und ins Lager gebracht werden. Spülmaschine, Gläser, Töpfe.'},
    abbau: {n: 'Abbau', info: 'Abbau: Schilder für Abbau aufhängen, Lagerstruktur beachten. 14:00 Kerzen und Blumen einsammeln. 15:00 offizielles Verabschieden + Foto. 15:30 Rückbau Yogazimmer. Kerzenständer einsammeln und putzen, alle Blumen in einen Eimer mit Wasser. Beschilderung abhängen. Alles ins Lager!'},
    springer: {n: 'Springer', info: 'Springer unterstützen flexibel. Rundgang: 1. Sanitäranlagen (Papier, Seife, Desinfektion), 2. Bar (Nachschub, Leergut), 3. Milonga-Raum (Lüften bei Cortina, Kerzen, Tische abwischen), 4. Esstische (aufräumen). Sa+So morgens: zuerst beim Küchenteam melden! Material: Box unter dem Tisch im Bad.'}
  };

  var HOWTOS = [
    {title: 'Bar-Schicht', icon: '🍸', body: '<p><strong>Dauer:</strong> 1,5 Stunden pro Schicht</p><p><strong>Aufgaben:</strong></p><p>• Getränke ausschenken und nachschenken<br>• Nachschub aus dem Lager holen (Vorrat-Kisten unter dem Bartisch)<br>• Kühlschränke kontrollieren und auffüllen<br>• Spülstation prüfen – saubere Gläser vorhanden?<br>• Leergut einsammeln, sortieren, zum Sammelplatz bringen<br>• Müllbeutel bei Bedarf wechseln</p><p><strong>Wichtig:</strong> Bar von 21–22:30 geschlossen (Konzert)! Ab 20:30 übernimmt die Bar das Check-In.</p><p><strong>Material:</strong> Getränkekisten, Müllbeutel, ggf. Transportwagen. Kühlschrank steht neben der Bar.</p>'},
    {title: 'Springer', icon: '💃', body: '<p><strong>Ziel:</strong> Alles sauber, ordentlich und funktionsfähig halten. Flexibel unterstützen!</p><p><strong>Empfohlener Rundgang:</strong></p><p>1️⃣ <strong>Sanitäranlagen</strong> (10–15 min)<br>• Papierhandtücher + Toilettenpapier auffüllen<br>• Seifenspender prüfen<br>• Mülleimer leeren<br>• Waschbecken, Türklinken desinfizieren</p><p>2️⃣ <strong>Bar</strong> (5–10 min)<br>• Nachfragen ob Hilfe gebraucht wird<br>• Getränke nachfüllen, Leergut sortieren</p><p>3️⃣ <strong>Milonga-Raum</strong> (10–15 min)<br>• Kerzen prüfen, Wachsreste entfernen<br>• Bei Cortina stoßlüften!<br>• Tische feucht abwischen</p><p>4️⃣ <strong>Esstische</strong> (10 min)<br>• Abwischen, Müll entfernen, Geschirr zur Spülstation</p><p><strong>Sa+So morgens:</strong> Zuerst beim Küchenteam melden (Brunch-Hilfe?)!</p><p><strong>Material:</strong> Handschuhe + Reinigungsmittel in der Box unter dem Tisch im Bad.</p>'},
    {title: 'Check-In', icon: '📋', body: '<p><strong>Aufgaben:</strong></p><p>• Gäste empfangen und begrüßen<br>• Namenslisten prüfen<br>• Bändchen ausgeben<br>• Stempelkarten verkaufen!</p><p><strong>Wichtig:</strong> Ab 20:30 Uhr Check-In an die Bar übergeben.</p>'},
    {title: 'Brunch-Service', icon: '☕', body: '<p><strong>Aufgaben:</strong></p><p>• Vorbereitung mit dem Küchenteam<br>• Buffet aufbauen und auffüllen<br>• Während des Brunchs: Service, Getränke, Nachschub<br>• Geschirr abräumen und zur Spülstation bringen</p>'},
    {title: 'Aufbau & Abbau', icon: '🔨', body: '<p><strong>Aufbau (Do + Fr):</strong></p><p>• Bendito Banner aufhängen<br>• Rote Tischdecken auf kleine Tische<br>• Tische dekorieren<br>• Geschirr-Rückgabe vor dem Raum im Flur einrichten<br>• Bar aufbauen im Buffet-Raum<br>• Kerzen und Blumen aufstellen</p><p><strong>Abbau (So):</strong></p><p>• 13:00 Schilder für Abbau aufhängen, Lagerstruktur beachten<br>• 14:00 Kerzen und Blumen einsammeln<br>• 15:00 Offizielles Verabschieden + Foto<br>• 15:30 Rückbau Yogazimmer<br>• Kerzenständer putzen, Blumen in Eimer mit Wasser<br>• Beschilderung abhängen, alles ins Lager!</p>'},
    {title: 'Küche & Spülen', icon: '🍳', body: '<p><strong>Küche:</strong></p><p>• 13:00 Helferküche putzen<br>• Vorbereitung für Mahlzeiten<br>• Spülmaschine bedienen</p><p><strong>Spülen:</strong></p><p>• Alles muss gespült und ins Lager gebracht werden<br>• Gläser, Töpfe, Besteck</p>'},
    {title: 'Allgemeine Hinweise', icon: 'ℹ️', body: '<p>• <strong>Hygiene im Bad:</strong> Seife, Toilettenpapier, Desinfektionsmittel, Spiegel, Raumduft, Haarspray, Deo, Kaugummi, Tampons bereitstellen</p><p>• <strong>Helferessen:</strong> Donnerstag 19:30 Uhr</p><p>• <strong>Teamtreffen:</strong> Freitag, 30.10.2026, um 15:00 Uhr. Bitte komm, wenn möglich – das Kennenlernen im Team ist uns wichtig! Wenn du nicht dabei sein kannst, gib der Orga bitte kurz Bescheid.</p><p>• <strong>Bitte lies alle Infos unter „Anleitungen“ gut durch:</strong> Hier stehen die Grundlagen für deine Mithilfe, auch wenn du beim Treffen nicht dabei sein kannst.</p><p>• Bei Problemen oder Materialmangel: Rücksprache im Team – die erfahrenen Hasen wissen was zu tun ist.</p>'}
  ];

  var DAYS = [
    {id: 'fri', name: 'Freitag', sh: 'Fr', lb: 'Marathon Start'},
    {id: 'sat', name: 'Samstag', sh: 'Sa', lb: 'Marathon'},
    {id: 'sun', name: 'Sonntag', sh: 'So', lb: 'Marathon bis 17 Uhr'}
  ];
  var CONTACTS = ['', 'WhatsApp', 'Signal', 'Telegram', 'Threema', 'E-Mail', 'Telefon', 'SMS'];

  var ERR = {
    SWAP_STALE: 'Dieser Tausch ist nicht mehr aktuell, weil sich der Plan inzwischen geändert hat. Es wurde nichts getauscht.',
    SWAP_OVERLAP: 'Der Tausch geht nicht, weil sich die Schicht mit einer anderen Schicht überschneidet. Es wurde nichts getauscht.',
    SWAP_LOCKED: 'Der Tausch ist gesperrt. Bitte wende dich direkt an die Orga.',
    SWAP_NOT_ALLOWED: 'Diesen Tausch kannst du nicht ausführen. Es wurde nichts geändert.',
    SWAP_EXISTS: 'Diese Anfrage hast du schon gestellt.',
    SWAP_TOO_MANY: 'Du hast schon fünf offene Anfragen. Zieh eine zurück oder warte auf eine Antwort.',
    SHIFT_FULL: 'Die Schicht ist schon voll besetzt.',
    ASSIGN_DUPLICATE: 'Diese Person ist in der Schicht schon eingeteilt.',
    HELPER_INACTIVE: 'Dieser Helfer ist deaktiviert.',
    NAME_TAKEN: 'Diesen Namen gibt es schon.',
    INVALID_INPUT: 'Die Eingabe ist ungültig. Namen haben 1 bis 40 Zeichen und enthalten keine Adresse und keine Nummer.',
    NOT_FOUND: 'Der Eintrag wurde nicht gefunden. Der Plan wurde neu geladen.',
    CONFIRM_REQUIRED: 'Dafür fehlt die Bestätigung. Es wurde nichts geändert.'
  };
  function errText(code) { return ERR[code] || ('Das hat nicht geklappt (' + code + '). Es wurde nichts geändert.'); }

  // ===== Kleine Helfer =====
  function tc(bg) {
    var x = String(bg || '#cccccc').replace('#', '');
    var r = parseInt(x.substr(0, 2), 16), g = parseInt(x.substr(2, 2), 16), b = parseInt(x.substr(4, 2), 16);
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55 ? '#222' : '#fff';
  }
  function gst(t) { return ST[t] || {n: t, info: ''}; }
  function dayOf(id) { for (var i = 0; i < DAYS.length; i++) { if (DAYS[i].id === id) return DAYS[i]; } return {id: id, name: id, sh: id, lb: ''}; }
  function hrs(min) { return (Math.round(min / 6) / 10).toLocaleString('de-DE'); }
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  function fmtClock(d) { return p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds()); }
  function fmtDT(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return p2(d.getDate()) + '.' + p2(d.getMonth() + 1) + '. ' + p2(d.getHours()) + ':' + p2(d.getMinutes());
  }
  function toLocalInput(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + 'T' + p2(d.getHours()) + ':' + p2(d.getMinutes());
  }
  // „2026-11-15“ → „15.11.2026“. Alles andere ergibt einen leeren Text.
  function fmtDay(s) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); return m ? m[3] + '.' + m[2] + '.' + m[1] : ''; }
  function overlaps(a, b) { return a.start_min < b.end_min && b.start_min < a.end_min; }
  // Schichten vor 06:00 gehören zum Vorabend, liegen aber schon am Folgetag.
  var NEXT_SH = {fri: 'Sa', sat: 'So', sun: 'Mo'};
  function isNight(s) { return !!s && s.start_time < '06:00'; }
  function nightNote(s) { return isNight(s) ? 'Nacht auf ' + (NEXT_SH[s.day] || '') : ''; }
  function dayShort(s) { return dayOf(s.day).sh + (isNight(s) ? '/' + (NEXT_SH[s.day] || '') : ''); }

  function loadPrefs() {
    try { var p = JSON.parse(localStorage.getItem('hp-prefs')); if (p && typeof p === 'object') return p; } catch (e) {}
    return {};
  }
  function savePrefs(p) { try { localStorage.setItem('hp-prefs', JSON.stringify(p)); } catch (e) {} }

  // ===== Datenbank =====
  var sb = null;
  if (CFG.supabaseUrl && CFG.supabaseAnonKey && window.supabase) {
    sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseAnonKey, {
      auth: {persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'hp-auth'}
    });
  }

  function classify(error, status) {
    var msg = String((error && error.message) || error || '');
    var code = String((error && error.code) || '');
    if (code === '42501' || status === 401 || status === 403 || msg === 'NOT_ALLOWED') return {kind: 'denied', message: msg};
    if (!status || /Failed to fetch|NetworkError|Load failed|AbortError|aborted|timeout/i.test(msg)) return {kind: 'net', message: msg};
    return {kind: 'error', message: msg || ('HTTP ' + status)};
  }

  // Ruft eine hp_-Funktion auf. Erfolg: die Antwort. Fehler: {kind: 'net' | 'denied' | 'error'}.
  function rpcOnce(name, args) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, RPC_TIMEOUT_MS);
    return sb.rpc(name, args || {}).abortSignal(ctrl.signal).then(function (res) {
      clearTimeout(timer);
      if (res.error) { var c = classify(res.error, res.status); c.status = res.status; throw c; }
      return res.data;
    }, function (e) {
      clearTimeout(timer);
      throw {kind: 'net', message: String((e && e.message) || e)};
    });
  }
  // Antwortet der Server mit 401, ist das Zugriffstoken abgelaufen und die Anfrage
  // wurde nicht ausgeführt. Dann die Sitzung einmal erneuern und wiederholen. Das
  // passiert vor allem, wenn das Telefon lange im Hintergrund war.
  function rpc(name, args) {
    return rpcOnce(name, args).catch(function (e) {
      if (!e || e.status !== 401) throw e;
      return sb.auth.refreshSession().then(function (r) {
        if (r.error || !r.data || !r.data.session) throw e;
        return rpcOnce(name, args);
      }, function () { throw e; });
    });
  }

  // Tauscht den Code aus dem persönlichen Link gegen eine Sitzung.
  async function exchangeCode(code) {
    var res;
    try {
      res = await fetch(CFG.supabaseUrl + '/functions/v1/hp-login', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', apikey: CFG.supabaseAnonKey, Authorization: 'Bearer ' + CFG.supabaseAnonKey},
        body: JSON.stringify({code: code})
      });
    } catch (e) {
      throw {kind: 'net'};
    }
    if (res.status === 429) throw {kind: 'rate'};
    if (!res.ok) throw {kind: res.status >= 500 ? 'net' : 'invalid'};
    var body = await res.json();
    if (!body || !body.token_hash) throw {kind: 'invalid'};
    var v = await sb.auth.verifyOtp({token_hash: body.token_hash, type: body.type || 'magiclink'});
    if (v.error || !v.data || !v.data.session) throw {kind: 'invalid'};
  }

  // ===== Dialog: Fokus hinein, Tab bleibt im Dialog, Escape schließt, Fokus zurück =====
  var dialogSeq = 0;
  // Ist ein Dialog offen, stehen die Meldungen direkt unter ihm statt am Bildschirmrand,
  // damit sie auf kleinen Bildschirmen keine Knöpfe verdecken. Die App legt sie hier ab.
  var toastSlot = null;
  function Dialog(props) {
    var ref = useRef(null);
    var closeRef = useRef(props.onClose);
    closeRef.current = props.onClose;
    var idRef = useRef('dlg-' + (++dialogSeq));
    // Layout-Effekt: Der Fokus sitzt im Dialog, bevor die nächste Taste ankommt.
    useLayoutEffect(function () {
      var prev = document.activeElement;
      var el = ref.current;
      var first = el.querySelector('[data-autofocus]') || el.querySelector('input, select, textarea') || el.querySelector('.dlg-actions button') || el;
      first.focus();
      function onKey(e) {
        if (e.key === 'Escape') { e.stopPropagation(); closeRef.current(); return; }
        if (e.key !== 'Tab') return;
        var f = Array.prototype.slice.call(el.querySelectorAll('button, input, select, textarea, a[href]')).filter(function (n) { return !n.disabled && n.offsetParent !== null; });
        if (!f.length) { e.preventDefault(); return; }
        var a = f[0], z = f[f.length - 1];
        if (e.shiftKey && (document.activeElement === a || document.activeElement === el)) { e.preventDefault(); z.focus(); }
        else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
      }
      el.addEventListener('keydown', onKey);
      return function () {
        el.removeEventListener('keydown', onKey);
        if (prev && prev.focus && document.contains(prev)) prev.focus();
      };
    }, []);
    // Wird der gerade gedrückte Knopf gesperrt, fällt der Fokus aus dem Dialog. Zurückholen.
    useEffect(function () {
      var el = ref.current;
      if (el && (!document.activeElement || document.activeElement === document.body)) el.focus();
    });
    return html`
      <div class="overlay" onMouseDown=${function (e) { if (e.target === e.currentTarget) closeRef.current(); }}>
        <div class="popup" role="dialog" aria-modal="true" aria-labelledby=${idRef.current} tabindex="-1" ref=${ref}>
          <button class="popup-x" type="button" aria-label="Schließen" onClick=${function () { closeRef.current(); }}>×</button>
          <h3 id=${idRef.current}>${props.title}</h3>
          ${props.children}
        </div>
        ${toastSlot}
      </div>`;
  }

  function ConfirmDialog(props) {
    return html`
      <${Dialog} title=${props.title} onClose=${props.onClose}>
        <p class="dlg-p">${props.text}</p>
        <div class="dlg-actions">
          <button type="button" class=${'btn ' + (props.danger ? 'btn-red' : 'btn-purple')} data-autofocus="1" onClick=${props.onYes}>${props.yes || 'Ja'}</button>
          <button type="button" class="btn btn-ghost" onClick=${props.onClose}>Abbrechen</button>
        </div>
      <//>`;
  }

  // ===== Formulare. Eigener Zustand je Formular, Schreiben immer funktional. =====
  function SwapForm(props) {
    var d = props.d, from = props.from;
    var [target, setTarget] = useState('');
    var [note, setNote] = useState('');
    var mine = (d.byHelper[d.me] || []).filter(function (id) { return id !== from.id; }).map(function (id) { return d.sById[id]; });
    function optionFor(s) {
      var inIt = (d.byShift[s.id] || []);
      var clash = mine.some(function (m) { return overlaps(s, m); });
      var free = s.capacity - inIt.length;
      var who = inIt.map(function (hid) { return (d.hById[hid] || {}).display_name || '?'; }).join(', ');
      var label = s.start_time + (isNight(s) ? ' (' + nightNote(s) + ')' : '') + ' ' + gst(s.type_key).n + (free > 0 ? ' · freier Platz' : ' · mit ' + who) + (clash ? ' · überschneidet sich' : '');
      return html`<option key=${s.id} value=${s.id} disabled=${clash}>${label}</option>`;
    }
    var groups = DAYS.map(function (day) {
      var list = d.shifts.filter(function (s) { return s.day === day.id && s.id !== from.id && (d.byShift[s.id] || []).indexOf(d.me) === -1; });
      return html`<optgroup key=${day.id} label=${day.name}>${list.map(optionFor)}</optgroup>`;
    });
    var t = target ? d.sById[target] : null;
    var isMove = t ? (d.byShift[t.id] || []).length < t.capacity : false;
    return html`
      <${Dialog} title="Tausch anfragen" onClose=${props.onClose}>
        <p class="dlg-p">Du gibst ab: <strong>${dayShort(from)} ${from.start_time} ${gst(from.type_key).n}</strong></p>
        <div class="field">
          <label for="swap-target">Dafür möchtest du</label>
          <select id="swap-target" value=${target} onChange=${function (e) { setTarget(e.target.value); }}>
            <option value="">Schicht wählen …</option>
            ${groups}
          </select>
          ${t ? html`<div class="hint">${isMove
            ? 'In dieser Schicht ist ein Platz frei. Die Orga gibt den Wechsel frei.'
            : 'Die dort eingeteilte Person bekommt deine Anfrage und kann annehmen oder ablehnen.'}</div>` : null}
        </div>
        <div class="field">
          <label for="swap-note">Notiz (optional, höchstens 200 Zeichen)</label>
          <textarea id="swap-note" maxlength="200" value=${note} onInput=${function (e) { setNote(e.target.value); }}></textarea>
          <div class="hint">Bitte keine Telefonnummern oder Adressen. Die Notiz sehen die Beteiligten und die Orga.</div>
        </div>
        <div class="dlg-actions">
          <button type="button" class="btn btn-purple" disabled=${!target || props.disabled} onClick=${function () { props.onSubmit(from.id, target, note); }}>Anfrage senden</button>
          <button type="button" class="btn btn-ghost" onClick=${props.onClose}>Abbrechen</button>
        </div>
      <//>`;
  }

  function HelperForm(props) {
    var h = props.helper || {};
    var [f, setF] = useState({
      name: h.display_name || '', color: h.color || '#C9962B', contact: h.contact_channel || '',
      setup: !!h.is_setup_team, target: h.target_shifts == null ? '' : String(h.target_shifts), test: !!h.is_test
    });
    var fRef = useRef(f);
    fRef.current = f;
    function set(key) {
      return function (e) {
        var v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setF(function (prev) { var n = Object.assign({}, prev); n[key] = v; return n; });
      };
    }
    function submit() {
      var cur = fRef.current;
      props.onSubmit({
        p_id: h.id || null, p_name: cur.name, p_color: cur.color, p_contact: cur.contact,
        p_setup: cur.setup, p_target: cur.target === '' ? null : parseInt(cur.target, 10), p_is_test: cur.test
      });
    }
    return html`
      <${Dialog} title=${h.id ? 'Helfer bearbeiten' : 'Helfer anlegen'} onClose=${props.onClose}>
        <div class="field">
          <label for="hf-name">Anzeigename</label>
          <input id="hf-name" type="text" maxlength="40" value=${f.name} onInput=${set('name')} />
          <div class="hint">Vorname oder Spitzname genügt. Keine Telefonnummer, keine E-Mail-Adresse.</div>
        </div>
        <div class="s-row">
          <div class="field">
            <label for="hf-contact">Bevorzugter Kontaktweg</label>
            <select id="hf-contact" value=${f.contact} onChange=${set('contact')}>
              ${CONTACTS.map(function (c) { return html`<option key=${c} value=${c}>${c || '– keine Angabe –'}</option>`; })}
            </select>
          </div>
          <div class="field">
            <label for="hf-target">Soll-Schichten (leer = Standard)</label>
            <input id="hf-target" type="number" min="0" max="30" value=${f.target} onInput=${set('target')} />
          </div>
        </div>
        <div class="s-row">
          <div>
            <label class="lbl" for="hf-color">Farbe</label>
            <input id="hf-color" class="color-inp" type="color" value=${f.color} onInput=${set('color')} />
          </div>
          <label class="check"><input type="checkbox" checked=${f.setup} onChange=${set('setup')} /> Aufbau-Team</label>
          <label class="check"><input type="checkbox" checked=${f.test} onChange=${set('test')} /> Testhelfer</label>
        </div>
        <div class="dlg-actions">
          <button type="button" class="btn btn-gold" disabled=${props.disabled} onClick=${submit}>Speichern</button>
          <button type="button" class="btn btn-ghost" onClick=${props.onClose}>Abbrechen</button>
        </div>
      <//>`;
  }

  function mailHref(name, url) {
    var subject = 'Bendito: dein Helferplan';
    var body = 'Hallo ' + name + ',\n\n'
      + 'dein persönlicher Link zum Helferplan. Er öffnet deine Schichten. Bitte nicht weiterleiten.\n\n'
      + url + '\n\n'
      + '---\n\n'
      + 'Hello ' + name + ',\n\n'
      + 'your personal link to the helper plan. It opens your shifts. Please do not forward it.\n\n'
      + url + '\n\n'
      + 'Norbert für die Orga';
    return 'mailto:?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  }
  function LinkDialog(props) {
    var [copied, setCopied] = useState(false);
    var inpRef = useRef(null);
    function copy() {
      var done = function () { setCopied(true); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(props.url).then(done, function () { if (inpRef.current) { inpRef.current.select(); } });
      } else if (inpRef.current) {
        inpRef.current.select();
        try { document.execCommand('copy'); done(); } catch (e) {}
      }
    }
    return html`
      <${Dialog} title=${'Login-Link für ' + props.name} onClose=${props.onClose}>
        <p class="dlg-p"><strong>Dieser Link wird nur jetzt angezeigt.</strong> Kopiere ihn und schicke ihn der Person direkt, zum Beispiel per WhatsApp. Nach dem Schließen lässt er sich nicht wieder anzeigen, nur neu erzeugen. Ein neuer Link macht den alten sofort ungültig.</p>
        <p class="dlg-p">Die App verschickt keine Mail. „Mail vorbereiten“ öffnet dein Mailprogramm. Die Adresse trägst du dort ein.</p>
        <input class="linkbox" type="text" readonly aria-label="Persönlicher Login-Link" value=${props.url} ref=${inpRef} onFocus=${function (e) { e.target.select(); }} />
        <div class="dlg-actions">
          <button type="button" class="btn btn-gold" data-autofocus="1" onClick=${copy}>${copied ? 'Kopiert ✓' : 'Link kopieren'}</button>
          <a class="btn btn-ghost" href=${mailHref(props.name, props.url)}>Mail vorbereiten</a>
          <button type="button" class="btn btn-ghost" onClick=${props.onClose}>Fertig</button>
        </div>
      <//>`;
  }

  function PurgeDialog(props) {
    var [exported, setExported] = useState(false);
    var [word, setWord] = useState('');
    return html`
      <${Dialog} title="Helferdaten löschen" onClose=${props.onClose}>
        <p class="dlg-p">Löscht <strong>alle Helfer</strong> samt Zuweisungen, Tauschvorgängen, Hinweisen, Login-Links und Protokoll. Schichtraster, Einstellungen und Orga-Konten bleiben. Das lässt sich nicht rückgängig machen.</p>
        <p class="dlg-p">1. Zuerst den Plan als Datei sichern. Die Datei enthält Namen und gehört nicht in fremde Hände.</p>
        <button type="button" class="btn btn-ghost" onClick=${function () { props.onExport(); setExported(true); }}>${exported ? 'Plan gesichert ✓' : 'Plan als Datei sichern'}</button>
        <div class="field" style=${{marginTop: '14px'}}>
          <label for="purge-word">2. Zur Bestätigung LÖSCHEN eintippen</label>
          <input id="purge-word" type="text" autocomplete="off" value=${word} onInput=${function (e) { setWord(e.target.value); }} />
        </div>
        <div class="dlg-actions">
          <button type="button" class="btn btn-red" disabled=${!exported || word.trim().toUpperCase() !== 'LÖSCHEN' || props.disabled} onClick=${props.onPurge}>Endgültig löschen</button>
          <button type="button" class="btn btn-ghost" onClick=${props.onClose}>Abbrechen</button>
        </div>
      <//>`;
  }

  function LoginScreen(props) {
    var [mode, setMode] = useState('helper');
    var [email, setEmail] = useState('');
    var [pw, setPw] = useState('');
    var [busy, setBusy] = useState(false);
    var [err, setErr] = useState('');
    var valRef = useRef({});
    valRef.current = {email: email, pw: pw};
    function submit(e) {
      e.preventDefault();
      var v = valRef.current;
      if (!v.email || !v.pw || busy) return;
      setBusy(true); setErr('');
      props.onAdminLogin(v.email.trim(), v.pw).then(function (msg) {
        setBusy(false);
        if (msg) { setErr(msg); setPw(''); }
      });
    }
    return html`
      <main class="login-overlay">
        <div class="login-box">
          <img class="login-logo" src=${LOGO} alt="Bendito Tango Marathon" />
          <h1>Helferplan</h1>
          ${props.message ? html`<div class="err" role="alert">${props.message}</div>` : null}
          ${mode === 'helper' ? html`<div key="helper">
            <p>Bitte öffne deinen persönlichen Link. Du hast ihn von der Orga bekommen.</p>
            <a class="login-link" href="mithilfe.html">Mithilfe anbieten</a>
            <button type="button" class="login-link" onClick=${function () { setMode('admin'); }}>Orga-Login</button>
          </div>` : html`<div key="admin">
            <form onSubmit=${submit}>
              <p>Anmeldung für die Orga</p>
              ${err ? html`<div class="err" role="alert">${err}</div>` : null}
              <label for="lg-email">E-Mail</label>
              <input id="lg-email" type="email" autocomplete="username" value=${email} onInput=${function (e) { setEmail(e.target.value); }} />
              <label for="lg-pw">Passwort</label>
              <input id="lg-pw" type="password" autocomplete="current-password" value=${pw} onInput=${function (e) { setPw(e.target.value); }} />
              <button type="submit" class="btn btn-gold" disabled=${busy}>${busy ? 'Anmelden …' : 'Anmelden'}</button>
            </form>
            <button type="button" class="login-link" onClick=${function () { setMode('helper'); setErr(''); }}>Zurück</button>
          </div>`}
          <a class="login-link" href=${BENDITO_APP} referrerpolicy="no-referrer">← Zur Bendito-App</a>
          <div class="login-ver">Version ${VERSION}</div>
        </div>
      </main>`;
  }

  function MessageScreen(props) {
    return html`
      <main class="login-overlay">
        <div class="login-box">
          <img class="login-logo" src=${LOGO} alt="Bendito Tango Marathon" />
          <h1>Helferplan</h1>
          <p role="status">${props.text}</p>
          ${props.onRetry ? html`<button type="button" class="btn btn-gold" onClick=${props.onRetry}>Erneut versuchen</button>` : null}
          <a class="login-link" href=${BENDITO_APP} referrerpolicy="no-referrer">← Zur Bendito-App</a>
          <div class="login-ver">Version ${VERSION}</div>
        </div>
      </main>`;
  }

  function PasswordForm(props) {
    var [a, setA] = useState('');
    var [b, setB] = useState('');
    var [msg, setMsg] = useState(null);
    var [busy, setBusy] = useState(false);
    var valRef = useRef({});
    valRef.current = {a: a, b: b};
    function submit(e) {
      e.preventDefault();
      var v = valRef.current;
      if (v.a.length < 10) { setMsg({ok: false, text: 'Das Passwort braucht mindestens 10 Zeichen.'}); return; }
      if (v.a !== v.b) { setMsg({ok: false, text: 'Die beiden Eingaben stimmen nicht überein.'}); return; }
      setBusy(true);
      sb.auth.updateUser({password: v.a}).then(function (res) {
        setBusy(false);
        if (res.error) { setMsg({ok: false, text: 'Das Passwort wurde nicht geändert: ' + res.error.message}); return; }
        setA(''); setB(''); setMsg({ok: true, text: 'Passwort geändert.'});
      }, function () { setBusy(false); setMsg({ok: false, text: 'Keine Verbindung. Das Passwort wurde nicht geändert.'}); });
    }
    return html`
      <form onSubmit=${submit}>
        <div class="s-row">
          <div class="field"><label for="pw-a">Neues Passwort</label><input id="pw-a" type="password" autocomplete="new-password" value=${a} onInput=${function (e) { setA(e.target.value); }} /></div>
          <div class="field"><label for="pw-b">Wiederholen</label><input id="pw-b" type="password" autocomplete="new-password" value=${b} onInput=${function (e) { setB(e.target.value); }} /></div>
          <button type="submit" class="btn btn-ghost" disabled=${busy || props.disabled}>Passwort ändern</button>
        </div>
        ${msg ? html`<div class=${'notice ' + (msg.ok ? 'info' : 'err')} role="status" style=${{margin: '8px 0 0'}}><span>${msg.text}</span></div>` : null}
      </form>`;
  }

  function OfferReply(props) {
    var o = props.offer;
    var [subject, setSubject] = useState(o.reply_subject || 'Bendito – deine Mithilfe');
    var [body, setBody] = useState(o.reply_body || '');
    var [status, setStatus] = useState(o.reply_status || 'open');
    var [revision, setRevision] = useState(o.reply_revision || 0);
    var [busy, setBusy] = useState(false);
    var [message, setMessage] = useState('');
    var [saved, setSaved] = useState(true);
    function save(e) {
      e.preventDefault(); setBusy(true); setMessage('');
      rpc('hp_admin_save_offer_reply', {p_id: o.id, p_subject: subject, p_body: body,
        p_status: status, p_revision: revision}).then(function (r) {
        if (!r.ok) { setMessage(r.code === 'CONFLICT' ? 'Inzwischen geändert. Bitte neu laden; dein Text bleibt hier erhalten.' : 'Bitte Eingaben prüfen.'); return; }
        setRevision(r.revision); setSaved(true); setMessage('Gespeichert. Es wurde keine Nachricht versendet.');
      }, function () { setMessage('Speichern fehlgeschlagen. Dein Text bleibt hier erhalten; bitte erneut versuchen.'); })
        .finally(function () { setBusy(false); });
    }
    return html`<form onSubmit=${save}>
      <h4>Antwort vorbereiten</h4>
      <div class="field"><label for=${'reply-subject-' + o.id}>Betreff</label>
        <input id=${'reply-subject-' + o.id} maxlength="200" value=${subject} disabled=${busy} onInput=${function (e) { setSubject(e.target.value); setSaved(false); }} /></div>
      <div class="field"><label for=${'reply-body-' + o.id}>Antwortentwurf</label>
        <textarea id=${'reply-body-' + o.id} rows="5" maxlength="5000" value=${body} disabled=${busy} onInput=${function (e) { setBody(e.target.value); setSaved(false); }}></textarea></div>
      <div class="field"><label for=${'reply-status-' + o.id}>Bearbeitungsstand</label>
        <select id=${'reply-status-' + o.id} value=${status} disabled=${busy} onChange=${function (e) { setStatus(e.target.value); setSaved(false); }}>
          <option value="open">Offen</option><option value="draft">Entwurf</option>
          <option value="done">Erledigt / anderweitig beantwortet</option><option value="no_reply">Keine Nachricht nötig</option>
        </select></div>
      <div class="btn-row"><button class="btn btn-gold" type="submit" disabled=${busy}>${busy ? 'Speichert …' : 'Entwurf und Stand speichern'}</button>
        ${saved && body ? html`<a class="btn btn-ghost" href=${'mailto:' + encodeURIComponent(o.email) + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body)}>Im Mailprogramm öffnen</a>` : null}
      </div>
      <p class="mini-sub">${saved ? 'Die App versendet keine E-Mails. Im Mailprogramm selbst prüfen und versenden.' : 'Ungespeicherte Änderungen.'}</p>
      ${message ? html`<p role="status">${message}</p>` : null}
    </form>`;
  }

  // Private addresses are write-only and never kept in the plan or browser storage.
  function HelperMail(props) {
    var [status, setStatus] = useState(null);
    var [failed, setFailed] = useState(false);
    var input = useRef(null);
    useEffect(function () {
      var active = true;
      rpc('hp_admin_helper_mail_list').then(function (rows) {
        if (active) setStatus(rows.filter(function (x) { return x.helper_id === props.id; })[0] || {has_mail: false});
      }, function () { if (active) setFailed(true); });
      return function () { active = false; };
    }, [props.id]);
    function save(e) {
      e.preventDefault();
      var address = input.current.value.trim();
      input.current.value = '';
      props.act('hp_admin_set_helper_mail', {p_helper: props.id, p_email: address}, {
        okText: address ? 'Mail hinterlegt.' : 'Mail entfernt.',
        onOk: function () { setStatus({has_mail: !!address}); setFailed(false); }
      });
    }
    return html`<form class="s-row" onSubmit=${save}>
      <div class="field"><label for=${'mail-' + props.id}>Mail für Benachrichtigungen</label>
        <input ref=${input} id=${'mail-' + props.id} type="email" autocomplete="off" disabled=${props.disabled} />
        <span class="mini-sub">${failed ? 'Mailstatus nicht geladen' : status ? (status.has_mail ? 'Mail hinterlegt' : 'keine Mail') : 'Mailstatus wird geladen…'}</span>
      </div>
      <button class="btn btn-ghost btn-sm" type="submit" disabled=${props.disabled}>Speichern</button>
      <span class="mini-sub">Leer speichern entfernt die Mail.</span>
    </form>`;
  }

  function MyMail(props) {
    var [status, setStatus] = useState(null);
    var [failed, setFailed] = useState(false);
    useEffect(function () {
      var active = true;
      rpc('hp_my_mail_enabled', {p_on: null}).then(function (r) {
        if (active && r.ok) setStatus(r);
      }, function () { if (active) setFailed(true); });
      return function () { active = false; };
    }, []);
    if (!status) return html`<p class="s-note">${failed ? 'Deine Mail-Einstellung konnte nicht geladen werden.' : 'Mail-Einstellung wird geladen…'}</p>`;
    return html`<div class="s-note">
      <label class="check"><input type="checkbox" checked=${status.enabled} disabled=${props.disabled || !status.has_mail}
        onChange=${function (e) {
          props.act('hp_my_mail_enabled', {p_on: e.target.checked}, {onOk: setStatus});
        }} /> Mail bei Tausch und Änderungen</label>
      <p>${!status.has_mail ? 'Für dich ist noch keine Mail hinterlegt. Bitte melde dich bei der Orga.' : status.enabled ? 'Bei Tauschanfragen bekommst du zusätzlich eine Mail.' : 'Die Mails sind ausgeschaltet. Hinweise findest du weiter hier in der App.'}</p>
    </div>`;
  }

  function SettingsForms(props) {
    var d = props.d, act = props.act, off = props.disabled;
    var st = d.settings;
    var [tg, setTg] = useState({shifts: String(st.target_shifts), hours: String(st.target_hours)});
    var [lockAt, setLockAt] = useState(toLocalInput(st.swaps_lock_at));
    var [lockWanted, setLockWanted] = useState(null); // gewählter Zustand, bis der Server geantwortet hat
    var [add, setAdd] = useState({name: '', color: '#C9962B', contact: '', setup: false, test: false});
    var [bulk, setBulk] = useState({text: '', test: false});
    var ref = useRef({});
    ref.current = {tg: tg, lockAt: lockAt, add: add, bulk: bulk};
    function setIn(setter, key) {
      return function (e) {
        var v = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
        setter(function (prev) { var n = Object.assign({}, prev); n[key] = v; return n; });
      };
    }
    function saveTargets() {
      var v = ref.current.tg;
      var s = parseInt(v.shifts, 10), h = parseFloat(String(v.hours).replace(',', '.'));
      act('hp_admin_set_setting', {p_key: 'target_shifts', p_value: s}).then(function (r) {
        if (r && r.ok) act('hp_admin_set_setting', {p_key: 'target_hours', p_value: h}, {okText: 'Soll-Werte gespeichert.'});
      });
    }
    function saveLockAt() {
      var v = ref.current.lockAt;
      var val = v ? new Date(v).toISOString() : null;
      act('hp_admin_set_setting', {p_key: 'swaps_lock_at', p_value: val}, {okText: val ? 'Sperrzeitpunkt gespeichert.' : 'Sperrzeitpunkt entfernt.'});
    }
    function addOne() {
      var v = ref.current.add;
      if (!v.name.trim()) return;
      act('hp_admin_upsert_helper', {p_id: null, p_name: v.name, p_color: v.color, p_contact: v.contact, p_setup: v.setup, p_target: null, p_is_test: v.test}, {
        okText: 'Helfer angelegt.',
        onOk: function () { setAdd(function (p) { return Object.assign({}, p, {name: '', test: false}); }); }
      });
    }
    function addMany() {
      var v = ref.current.bulk;
      var names = v.text.split('\n').map(function (x) { return x.trim(); }).filter(function (x) { return x; });
      if (!names.length) return;
      act('hp_admin_add_helpers', {p_names: names, p_is_test: v.test}, {
        okText: function (r) {
          var t = r.created + ' Helfer angelegt.';
          if (r.skipped && r.skipped.length) t += ' Übersprungen (doppelt oder ungültig): ' + r.skipped.join(', ') + '.';
          return t;
        },
        onOk: function () { setBulk(function (p) { return Object.assign({}, p, {text: '', test: false}); }); }
      });
    }
    return html`<div>
      <div class="s-block">
        <h3>Soll-Werte</h3>
        <div class="s-note">Standard: 6 Schichten × 1,5 h = 9 h pro Helfer.</div>
        <div class="s-row">
          <div class="field"><label for="st-shifts">Schichten</label><input id="st-shifts" type="number" min="1" max="20" value=${tg.shifts} onInput=${setIn(setTg, 'shifts')} /></div>
          <div class="field"><label for="st-hours">Stunden gesamt</label><input id="st-hours" type="number" min="1" max="100" step="0.5" value=${tg.hours} onInput=${setIn(setTg, 'hours')} /></div>
          <button type="button" class="btn btn-gold" disabled=${off} onClick=${saveTargets}>Speichern</button>
        </div>
      </div>
      <div class="s-block">
        <h3>Schichttausch</h3>
        <div class="s-note">${st.locked ? 'Der Tausch ist zurzeit gesperrt.' : 'Der Tausch ist zurzeit offen.'} Die Orga kann unabhängig davon weiter zuweisen.</div>
        <label class="check"><input type="checkbox" id="st-locked" checked=${lockWanted === null ? !!st.swaps_locked : lockWanted} disabled=${off}
          onChange=${function (e) {
            var want = e.target.checked;
            setLockWanted(want);
            act('hp_admin_set_setting', {p_key: 'swaps_locked', p_value: want}, {okText: want ? 'Tausch gesperrt.' : 'Schalter „gesperrt“ gelöst.'})
              .then(function () { setLockWanted(null); });
          }} /> Tausch gesperrt</label>
        <div class="s-row">
          <div class="field"><label for="st-lockat">Automatisch gesperrt ab</label><input id="st-lockat" type="datetime-local" value=${lockAt} onInput=${function (e) { setLockAt(e.target.value); }} /></div>
          <button type="button" class="btn btn-gold" disabled=${off} onClick=${saveLockAt}>Speichern</button>
        </div>
      </div>
      <div class="s-block">
        <h3>Helfer anlegen</h3>
        <div class="s-row">
          <div class="field"><label for="ad-name">Anzeigename</label><input id="ad-name" type="text" maxlength="40" value=${add.name} onInput=${setIn(setAdd, 'name')} onKeyDown=${function (e) { if (e.key === 'Enter') addOne(); }} /></div>
          <div class="field"><label for="ad-contact">Kontaktweg</label>
            <select id="ad-contact" value=${add.contact} onChange=${setIn(setAdd, 'contact')}>
              ${CONTACTS.map(function (c) { return html`<option key=${c} value=${c}>${c || '– keine Angabe –'}</option>`; })}
            </select></div>
          <div><label class="lbl" for="ad-color">Farbe</label><input id="ad-color" class="color-inp" type="color" value=${add.color} onInput=${setIn(setAdd, 'color')} /></div>
        </div>
        <div class="s-row">
          <label class="check"><input type="checkbox" checked=${add.setup} onChange=${setIn(setAdd, 'setup')} /> Aufbau-Team</label>
          <label class="check"><input type="checkbox" id="ad-test" checked=${add.test} onChange=${setIn(setAdd, 'test')} /> Testhelfer</label>
          <button type="button" class="btn btn-gold" disabled=${off || !add.name.trim()} onClick=${addOne}>Anlegen</button>
        </div>
        <div class="s-note" style=${{marginTop: '8px'}}>Nur Anzeigename und Kontaktweg. Keine Telefonnummer, keine E-Mail-Adresse.</div>
      </div>
      <div class="s-block">
        <h3>Mehrere Namen einfügen</h3>
        <div class="field">
          <label for="bulk-names">Ein Name pro Zeile</label>
          <textarea id="bulk-names" rows="5" value=${bulk.text} onInput=${setIn(setBulk, 'text')}></textarea>
        </div>
        <div class="s-row">
          <label class="check"><input type="checkbox" id="bulk-test" checked=${bulk.test} onChange=${setIn(setBulk, 'test')} /> als Testhelfer</label>
          <button type="button" class="btn btn-gold" disabled=${off || !bulk.text.trim()} onClick=${addMany}>Alle anlegen</button>
        </div>
      </div>
    </div>`;
  }

  // ===== Abgeleitete Daten aus dem Abruf =====
  function derive(snap) {
    var d = {};
    d.role = snap.ctx.role;
    d.isAdmin = d.role === 'admin';
    d.isHelper = d.role === 'helper';
    d.me = snap.ctx.helper_id || null;
    d.settings = snap.settings;
    d.allHelpers = snap.helpers;
    d.helpers = snap.helpers.filter(function (h) { return h.active !== false; });
    d.hById = {};
    snap.helpers.forEach(function (h) { d.hById[h.id] = h; });
    d.shifts = snap.shifts;
    d.sById = {};
    snap.shifts.forEach(function (s) { d.sById[s.id] = s; });
    d.byShift = {}; d.byHelper = {};
    snap.assignments.forEach(function (a) {
      (d.byShift[a.shift_id] = d.byShift[a.shift_id] || []).push(a.helper_id);
      (d.byHelper[a.helper_id] = d.byHelper[a.helper_id] || []).push(a.shift_id);
    });
    d.stats = {};
    snap.helpers.forEach(function (h) {
      var ids = d.byHelper[h.id] || [];
      var min = ids.reduce(function (sum, id) { return sum + (d.sById[id] ? d.sById[id].duration_min : 0); }, 0);
      var tgt = h.target_shifts == null ? d.settings.target_shifts : h.target_shifts;
      var tgtMin = d.settings.target_shifts > 0 ? (d.settings.target_hours * 60) * (tgt / d.settings.target_shifts) : d.settings.target_hours * 60;
      d.stats[h.id] = {c: ids.length, min: min, tgt: tgt, tgtMin: tgtMin};
    });
    d.dayStats = {};
    var tot = 0, fil = 0;
    DAYS.forEach(function (day) {
      var t = 0, f = 0;
      snap.shifts.forEach(function (s) { if (s.day === day.id) { t += s.capacity; f += (d.byShift[s.id] || []).length; } });
      d.dayStats[day.id] = {tot: t, fil: f, pct: t > 0 ? Math.round(f / t * 100) : 0};
      tot += t; fil += f;
    });
    d.total = {tot: tot, fil: fil, pct: tot > 0 ? Math.round(fil / tot * 100) : 0};
    d.swaps = snap.swaps;
    d.swById = {};
    snap.swaps.forEach(function (w) { d.swById[w.id] = w; });
    d.notifications = snap.notifications;
    d.unread = snap.notifications.filter(function (n) { return !n.read_at; }).length;
    d.pending = snap.swaps.filter(function (w) { return w.status === 'pending'; });
    d.mySwaps = d.me ? snap.swaps.filter(function (w) { return w.from_helper === d.me; }) : [];
    d.incoming = d.me ? d.pending.filter(function (w) {
      return w.kind === 'swap' && w.from_helper !== d.me && (d.byShift[w.to_shift] || []).indexOf(d.me) !== -1;
    }) : [];
    d.pendingMoves = d.pending.filter(function (w) { return w.kind === 'move'; });
    // Eigene offene Anfragen je abgegebener Schicht, für die Markierung im Plan.
    d.myPendingFrom = {};
    d.mySwaps.forEach(function (w) {
      if (w.status === 'pending') (d.myPendingFrom[w.from_shift] = d.myPendingFrom[w.from_shift] || []).push(w);
    });
    d.serverNow = new Date(snap.ctx.server_time);
    if (isNaN(d.serverNow.getTime())) d.serverNow = new Date();
    return d;
  }
  function nameOf(d, id) { var h = d.hById[id]; return h ? h.display_name : 'jemand'; }
  function shiftText(d, id) { var s = d.sById[id]; return s ? dayShort(s) + ' ' + s.start_time + ' ' + gst(s.type_key).n : '?'; }
  var STATUS_TXT = {pending: 'Offen', accepted: 'Angenommen', rejected: 'Abgelehnt', cancelled: 'Zurückgezogen', expired: 'Verfallen'};

  function buildExport(d) {
    return {
      exported_at: new Date().toISOString(),
      app_version: VERSION,
      hinweis: 'Diese Datei enthält Namen. Nicht weitergeben, nach dem Event löschen.',
      settings: d.settings,
      helpers: d.allHelpers.map(function (h) {
        return {name: h.display_name, color: h.color, contact_channel: h.contact_channel, setup_team: h.is_setup_team,
                target_shifts: h.target_shifts, active: h.active, test: h.is_test,
                shifts: (d.byHelper[h.id] || []).map(function (id) { return shiftText(d, id); })};
      }),
      shifts: d.shifts.map(function (s) {
        return {id: s.id, day: s.day, start_time: s.start_time, type: s.type_key, duration_min: s.duration_min, capacity: s.capacity,
                helpers: (d.byShift[s.id] || []).map(function (id) { return nameOf(d, id); })};
      }),
      swaps: d.swaps.map(function (w) {
        return {kind: w.kind, from: nameOf(d, w.from_helper), from_shift: shiftText(d, w.from_shift), to_shift: shiftText(d, w.to_shift),
                status: w.status, accepted_by: w.accepted_by ? nameOf(d, w.accepted_by) : null, created_at: w.created_at, resolved_at: w.resolved_at};
      })
    };
  }
  function downloadJson(obj, filename) {
    var blob = new Blob([JSON.stringify(obj, null, 2)], {type: 'application/json'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  // ===== App =====
  function App() {
    var prefs = useRef(loadPrefs()).current;
    var [phase, setPhase] = useState(sb ? 'boot' : 'noconfig'); // boot | noconfig | linking | login | offline | app
    var [loginMsg, setLoginMsg] = useState('');
    var [snap, setSnap] = useState(null);
    var [conn, setConn] = useState({ok: true, at: null});
    var [notice, setNotice] = useState(null);
    var [busy, setBusy] = useState(false);
    var [view, setViewRaw] = useState(prefs.view || 'board');
    var [offers, setOffers] = useState(null);
    var [offersErr, setOffersErr] = useState('');
    var [teamCakes, setTeamCakes] = useState(null);
    var [teamErr, setTeamErr] = useState('');
    var [teamPw, setTeamPw] = useState('');
    var [teamBusy, setTeamBusy] = useState(false);
    var [day, setDayRaw] = useState(prefs.day || 'fri');
    var [sel, setSel] = useState(null);     // gewählter Helfer zum Zuweisen (Orga)
    var [dd, setDd] = useState(null);       // offene Auswahlliste einer Schicht
    var [dlg, setDlg] = useState(null);     // offener Dialog
    var [htOpen, setHtOpen] = useState(null);
    var live = useRef({connOk: true, busy: false, loading: null, seq: 0});
    live.current.connOk = conn.ok;

    function setView(v) { setViewRaw(v); prefs.view = v; savePrefs(prefs); }
    function setDay(v) { setDayRaw(v); prefs.day = v; savePrefs(prefs); }

    function kick(msg) {
      live.current.loading = null; live.current.seq++;
      setSnap(null); setDlg(null); setSel(null); setNotice(null);
      setLoginMsg(msg || '');
      setPhase('login');
      if (sb) sb.auth.signOut({scope: 'local'}).catch(function () {});
    }

    // Lädt den Plan. Läuft schon ein Abruf, wird er mitbenutzt – außer nach einer
    // eigenen Änderung (force): Dann zählt nur ein Abruf, der danach gestartet ist.
    // Das Ergebnis eines überholten Abrufs wird verworfen.
    function refresh(force) {
      if (live.current.loading && !force) return live.current.loading;
      var seq = ++live.current.seq;
      var p = rpc('hp_state').then(function (data) {
        if (seq !== live.current.seq) return true;
        setSnap(data);
        setConn({ok: true, at: new Date()});
        return true;
      }, function (e) {
        if (seq !== live.current.seq) return false;
        if (e.kind === 'denied') { kick('Dieser Zugang ist nicht mehr gültig. Bitte hol dir bei der Orga einen neuen Link.'); return false; }
        setConn(function (c) { return {ok: false, at: c.at}; });
        return false;
      }).then(function (ok) { if (seq === live.current.seq) live.current.loading = null; return ok; });
      live.current.loading = p;
      return p;
    }

    function firstLoad() {
      return rpc('hp_state').then(function (data) {
        setSnap(data); setConn({ok: true, at: new Date()}); setLoginMsg(''); setPhase('app');
        return null;
      }, function (e) {
        if (e.kind === 'denied') {
          return sb.auth.signOut({scope: 'local'}).catch(function () {}).then(function () {
            return 'Dieses Konto hat keinen Zugriff auf den Helferplan.';
          });
        }
        setPhase('offline');
        return 'offline';
      });
    }

    function start() {
      var hash = location.hash || '';
      var hasCode = /^#k=/.test(hash);
      var m = /^#k=([0-9a-f]{64})$/.exec(hash);
      if (hasCode) {
        // Code sofort aus der Adresszeile nehmen.
        try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {}
        setPhase('linking');
        sb.auth.signOut({scope: 'local'}).catch(function () {}).then(function () {
          if (!m) throw {kind: 'invalid'};
          return exchangeCode(m[1]);
        }).then(function () {
          return firstLoad();
        }).then(function (msg) {
          if (msg && msg !== 'offline') { setLoginMsg(msg); setPhase('login'); }
        }).catch(function (e) {
          var text = 'Dieser Link ist nicht gültig. Bitte hol dir bei der Orga einen neuen Link.';
          if (e && e.kind === 'rate') text = 'Zu viele Versuche. Bitte warte zehn Minuten und öffne deinen Link dann erneut.';
          if (e && e.kind === 'net') text = 'Keine Verbindung. Bitte prüfe das Netz und öffne deinen Link erneut.';
          setLoginMsg(text); setPhase('login');
        });
        return;
      }
      sb.auth.getSession().then(function (r) {
        if (r.data && r.data.session) {
          firstLoad().then(function (msg) { if (msg && msg !== 'offline') { setLoginMsg(msg); setPhase('login'); } });
        } else {
          setPhase('login');
        }
      }, function () { setPhase('login'); });
    }

    useEffect(function () {
      if (!sb) return;
      start();
      var sub = sb.auth.onAuthStateChange(function (event) {
        if (event === 'SIGNED_OUT') { setSnap(null); setPhase(function (p) { return p === 'app' ? 'login' : p; }); }
      });
      // Wird der persönliche Link in einem Tab geöffnet, in dem die App schon läuft,
      // ändert sich nur der #-Teil und die Seite lädt nicht neu.
      function onHash() {
        if (/^#k=/.test(location.hash || '')) { live.current.loading = null; live.current.seq++; setSnap(null); setDlg(null); setSel(null); setNotice(null); start(); }
      }
      window.addEventListener('hashchange', onHash);
      return function () {
        window.removeEventListener('hashchange', onHash);
        if (sub && sub.data && sub.data.subscription) sub.data.subscription.unsubscribe();
      };
    }, []);

    // Abruf alle 20 Sekunden, bei Fensterfokus und wenn das Netz zurückkommt.
    useEffect(function () {
      if (phase !== 'app') return;
      var timer = setInterval(function () { if (!document.hidden) refresh(); }, POLL_MS);
      function onShow() { if (!document.hidden) refresh(); }
      function onOffline() { setConn(function (c) { return {ok: false, at: c.at}; }); }
      window.addEventListener('focus', onShow);
      document.addEventListener('visibilitychange', onShow);
      window.addEventListener('online', onShow);
      window.addEventListener('offline', onOffline);
      return function () {
        clearInterval(timer);
        window.removeEventListener('focus', onShow);
        document.removeEventListener('visibilitychange', onShow);
        window.removeEventListener('online', onShow);
        window.removeEventListener('offline', onOffline);
      };
    }, [phase]);

    // Escape hebt die Auswahl beim Zuweisen auf (Dialoge schließen sich selbst).
    useEffect(function () {
      function onKey(e) { if (e.key === 'Escape') { setSel(null); setDd(null); } }
      document.addEventListener('keydown', onKey);
      return function () { document.removeEventListener('keydown', onKey); };
    }, []);

    // Erfolgsmeldungen verschwinden von selbst, Fehler bleiben, bis sie geschlossen werden.
    useEffect(function () {
      if (!notice || notice.type !== 'info') return;
      var t = setTimeout(function () { setNotice(function (cur) { return cur === notice ? null : cur; }); }, 9000);
      return function () { clearTimeout(t); };
    }, [notice]);

    var d = useMemo(function () { return snap ? derive(snap) : null; }, [snap]);

    // Hinweise gelten als gelesen, sobald die Ansicht offen ist.
    useEffect(function () {
      if (phase === 'app' && view === 'inbox' && d && d.isHelper && d.unread > 0 && conn.ok) {
        rpc('hp_mark_read', {p_ids: null}).then(function () { refresh(); }, function () {});
      }
    }, [phase, view, d ? d.unread : 0]);

    function loadOffers() {
      setOffersErr('');
      return rpc('hp_admin_list_help_offers', {}).then(function (data) {
        setOffers(Array.isArray(data) ? data : []);
      }, function (e) {
        setOffersErr(e && e.kind === 'denied' ? 'Dafür hast du keine Berechtigung.' : 'Die Antworten ließen sich nicht laden.');
      });
    }
    useEffect(function () {
      if (phase === 'app' && view === 'offers') loadOffers();
    }, [phase, view]);

    // Die Orga sieht Kuchen, die nicht in der Gästeliste stehen. Das Passwort
    // bleibt im lokalen Speicher dieses Browsers und geht nicht als Cookie an GitHub.
    function loadTeamCakes(pw) {
      setTeamBusy(true);
      setTeamErr('');
      return fetch(CFG.supabaseUrl + '/rest/v1/rpc/kb_team', {
        method: 'POST',
        headers: {'Content-Type': 'application/json', apikey: CFG.supabaseAnonKey, Authorization: 'Bearer ' + CFG.supabaseAnonKey},
        body: JSON.stringify({p_pass: pw})
      }).then(function (res) {
        return res.json().then(function (data) {
          if (!res.ok) {
            var msg = data && data.message;
            if (msg === 'bad_password') {
              try { localStorage.removeItem('kb-team-pass'); } catch (e) {}
              setTeamCakes(null);
              setTeamErr('Das Passwort stimmt nicht.');
              return;
            }
            if (msg === 'rate_limited') { setTeamErr('Zu viele Versuche. Bitte eine Weile warten.'); return; }
            if (msg === 'closed') { setTeamErr('Die Kuchenliste ist geschlossen.'); return; }
            setTeamErr('Die Meldungen ließen sich nicht laden.');
            return;
          }
          try { localStorage.setItem('kb-team-pass', pw); } catch (e) {}
          setTeamPw('');
          setTeamCakes(Array.isArray(data) ? data : []);
        }, function () { setTeamErr('Die Meldungen ließen sich nicht laden.'); });
      }, function () { setTeamErr('Keine Verbindung.'); })
        .then(function () { setTeamBusy(false); });
    }
    useEffect(function () {
      if (phase !== 'app' || view !== 'cakes') return;
      var saved = '';
      try { saved = localStorage.getItem('kb-team-pass') || ''; } catch (e) {}
      if (saved) loadTeamCakes(saved);
    }, [phase, view]);

    // Führt eine ändernde Funktion aus, zeigt das Ergebnis und lädt den Plan neu.
    function act(name, args, opts) {
      opts = opts || {};
      if (!live.current.connOk || live.current.busy) return Promise.resolve(null);
      live.current.busy = true; setBusy(true);
      return rpc(name, args).then(function (data) {
        if (data && data.ok === false) {
          if (!(opts.onCode && opts.onCode(data) === true)) setNotice({type: 'err', text: errText(data.code)});
        } else {
          if (opts.okText) setNotice({type: 'info', text: typeof opts.okText === 'function' ? opts.okText(data) : opts.okText});
          else setNotice(null);
          if (opts.onOk) opts.onOk(data);
        }
        return data;
      }, function (e) {
        if (e.kind === 'denied') setNotice({type: 'err', text: 'Dafür hast du keine Berechtigung. Es wurde nichts geändert.'});
        else if (e.kind === 'net') {
          setConn(function (c) { return {ok: false, at: c.at}; });
          setNotice({type: 'err', text: 'Keine Verbindung. Ob die Änderung angekommen ist, siehst du, sobald der Plan wieder geladen ist.'});
        } else setNotice({type: 'err', text: 'Das hat nicht geklappt (' + e.message + '). Es wurde nichts geändert.'});
        return null;
      }).then(function (data) {
        live.current.busy = false; setBusy(false);
        return refresh(true).then(function () { return data; });
      });
    }

    function adminLogin(email, pw) {
      return sb.auth.signInWithPassword({email: email, password: pw}).then(function (res) {
        if (res.error) {
          var st = res.error.status || 0;
          if (st === 429) return 'Zu viele Anmeldeversuche. Bitte ein paar Minuten warten.';
          if (!st || st >= 500 || /fetch|network/i.test(res.error.message || '')) return 'Der Helferplan ist gerade nicht erreichbar. Bitte später erneut versuchen.';
          return 'E-Mail oder Passwort stimmt nicht.';
        }
        return firstLoad().then(function (msg) { return msg === 'offline' ? null : msg; });
      }, function () { return 'Keine Verbindung. Bitte später erneut versuchen.'; });
    }

    function logout() {
      live.current.loading = null; live.current.seq++;
      setSnap(null); setDlg(null); setSel(null); setNotice(null); setLoginMsg('');
      setPhase('login');
      sb.auth.signOut({scope: 'local'}).catch(function () {});
    }

    // ----- Bildschirme vor der App -----
    if (phase === 'noconfig') return html`<${MessageScreen} text="Die Datenbank ist noch nicht verbunden." />`;
    if (phase === 'boot') return html`<${MessageScreen} text="Helferplan wird geladen …" />`;
    if (phase === 'linking') return html`<${MessageScreen} text="Du wirst angemeldet …" />`;
    if (phase === 'offline') return html`<${MessageScreen} text="Keine Verbindung zum Helferplan. Bitte prüfe das Netz." onRetry=${function () { setPhase('boot'); start(); }} />`;
    if (phase === 'login' || !d) return html`<${LoginScreen} message=${loginMsg} onAdminLogin=${adminLogin} />`;

    var canAct = conn.ok && !busy;
    var off = !canAct;
    var isAdmin = d.isAdmin, isHelper = d.isHelper, me = d.me;
    var locked = !!d.settings.locked;
    var dayShifts = d.shifts.filter(function (s) { return s.day === day; });

    // ----- Aktionen -----
    function assign(shiftId, helperId, force) {
      setDd(null);
      act('hp_admin_assign', {p_shift: shiftId, p_helper: helperId, p_force: !!force}, {
        onCode: function (r) {
          if (r.code !== 'ASSIGN_OVERLAP') return false;
          setDlg({type: 'confirm', title: 'Schichten überschneiden sich',
            text: nameOf(d, helperId) + ' ist zur selben Zeit schon in ' + shiftText(d, r.conflict_shift) + ' eingeteilt. Trotzdem zusätzlich in ' + shiftText(d, shiftId) + ' einteilen?',
            yes: 'Trotzdem zuweisen', onYes: function () { setDlg(null); assign(shiftId, helperId, true); }});
          return true;
        }
      });
    }
    function slotClick(shiftId) {
      if (sel) assign(shiftId, sel, false);
      else setDd(dd === shiftId ? null : shiftId);
    }
    // Vor dem Entfernen warnen, wenn eine offene Tauschanfrage an der Zuweisung hängt.
    function unassign(shiftId, helperId) {
      var who = nameOf(d, helperId), where = shiftText(d, shiftId);
      var touched = d.pending.filter(function (w) {
        return (w.from_helper === helperId && w.from_shift === shiftId) || (w.kind === 'swap' && w.to_shift === shiftId && w.from_helper !== helperId);
      });
      var go = function () {
        setDlg(null);
        act('hp_admin_unassign', {p_shift: shiftId, p_helper: helperId}, {
          okText: who + ' ist aus ' + where + ' entfernt. Die Änderung steht im Posteingang der Person.'
        });
      };
      if (touched.length) {
        setDlg({type: 'confirm', title: 'Offene Tauschanfrage', yes: 'Trotzdem entfernen', onYes: go,
          text: 'An der Zuweisung von ' + who + ' in ' + where + ' hängt eine offene Tauschanfrage. Wenn du die Person entfernst, kann die Anfrage verfallen.'});
      } else go();
    }
    function requestSwap(fromId, toId, note) {
      setDlg(null);
      act('hp_swap_request', {p_from_shift: fromId, p_to_shift: toId, p_note: note}, {
        okText: function (r) {
          return r.kind === 'move'
            ? 'Anfrage gesendet. Die Orga gibt den Wechsel frei. Die Antwort siehst du unter „Mein Tausch“.'
            : 'Anfrage gesendet. Die Antwort siehst du unter „Mein Tausch“.';
        }
      });
    }
    function askAccept(w) {
      var mineNow = shiftText(d, w.to_shift), theirs = shiftText(d, w.from_shift);
      setDlg({type: 'confirm', title: 'Tausch annehmen?',
        text: 'Du gibst ' + mineNow + ' ab und übernimmst dafür ' + theirs + ' von ' + nameOf(d, w.from_helper) + '.',
        yes: 'Tauschen', onYes: function () { setDlg(null); act('hp_swap_accept', {p_swap: w.id}, {okText: 'Getauscht. Dein Plan ist aktualisiert.'}); }});
    }
    function approveMove(w) {
      act('hp_swap_accept', {p_swap: w.id}, {okText: 'Wechsel freigegeben.'});
    }
    function rejectSwap(w) { act('hp_swap_reject', {p_swap: w.id}, {okText: 'Anfrage abgelehnt.'}); }
    function cancelSwap(w) { act('hp_swap_cancel', {p_swap: w.id}, {okText: 'Anfrage zurückgezogen.'}); }
    function doExport() {
      var file = 'bendito-helferplan-' + new Date().toISOString().slice(0, 10) + '.json';
      var base = buildExport(d);
      if (!d.isAdmin) { downloadJson(base, file); return; }
      rpc('hp_admin_list_help_offers', {}).then(function (rows) {
        base.mithilfe = Array.isArray(rows) ? rows : [];
        base.hinweis = 'Diese Datei enthält Namen und, aus der Mithilfe-Abfrage, E-Mail-Adressen. Nicht weitergeben, nach dem Event löschen.';
        downloadJson(base, file);
      }, function () {
        base.mithilfe_hinweis = 'Die Mithilfe-Abfrage ließ sich nicht mitsichern.';
        downloadJson(base, file);
      });
    }
    function newLink(h) {
      var go = function () {
        setDlg(null);
        act('hp_admin_new_login_code', {p_helper: h.id}, {
          onOk: function (r) { setDlg({type: 'link', name: h.display_name, url: location.origin + location.pathname + '#k=' + r.code}); }
        });
      };
      if (h.has_login) {
        setDlg({type: 'confirm', title: 'Login-Link erneuern?', text: 'Der bisherige Link von ' + h.display_name + ' wird sofort ungültig, auch auf bereits angemeldeten Geräten.', yes: 'Neuen Link erzeugen', onYes: go});
      } else go();
    }
    function deactivate(h) {
      var n = (d.byHelper[h.id] || []).length;
      setDlg({type: 'confirm', danger: true, title: 'Helfer deaktivieren?',
        text: n > 0
          ? h.display_name + ' ist noch in ' + n + ' Schicht(en) eingeteilt. Beim Deaktivieren werden diese Zuweisungen entfernt und der Login-Link gesperrt.'
          : h.display_name + ' wird deaktiviert und der Login-Link gesperrt. Du kannst die Person später wieder aktivieren.',
        yes: n > 0 ? 'Deaktivieren und Schichten freigeben' : 'Deaktivieren',
        onYes: function () {
          setDlg(null);
          // Die Bestätigung gilt nur für das, was im Dialog stand: Kam inzwischen eine
          // Schicht dazu, lehnt der Server ab und es wird neu gefragt.
          act('hp_admin_deactivate_helper', {p_helper: h.id, p_confirm: n > 0}, {
            okText: h.display_name + ' ist deaktiviert.',
            onCode: function (r) {
              if (r.code !== 'CONFIRM_REQUIRED') return false;
              setNotice({type: 'err', text: h.display_name + ' wurde inzwischen einer Schicht zugewiesen. Bitte erneut auf „Deaktivieren“ tippen.'});
              return true;
            }
          });
        }});
    }

    // ----- Board -----
    function renderCard(shift, dupMap) {
      var st = gst(shift.type_key);
      var inIt = d.byShift[shift.id] || [];
      var full = inIt.length >= shift.capacity, empty = inIt.length === 0;
      var cls = full ? 'full' : (empty ? 'empty' : 'partial');
      var slots = Math.max(0, shift.capacity - inIt.length);
      var isMine = !!me && inIt.indexOf(me) !== -1;
      var dupes = dupMap[shift.start_time + '|' + shift.type_key];
      var suffix = dupes.length > 1 ? ' ' + 'ABCDEFGH'.charAt(dupes.indexOf(shift.id)) : '';
      var title = st.n + suffix;
      var incoming = d.pending.filter(function (w) { return w.to_shift === shift.id; });
      var myOut = isMine ? (d.myPendingFrom[shift.id] || []) : [];
      var slotBtns = [];
      for (var i = 0; i < slots; i++) {
        slotBtns.push(html`<button key=${i} type="button" class=${'slot' + (sel ? ' ready' : '')} disabled=${off}
          aria-label=${(sel ? nameOf(d, sel) + ' in ' : 'Platz besetzen in ') + shift.start_time + ' ' + title}
          onClick=${function (e) { e.stopPropagation(); slotClick(shift.id); }}>+</button>`);
      }
      var ddList = null;
      if (isAdmin && dd === shift.id && !sel) {
        var candidates = d.helpers.filter(function (h) { return inIt.indexOf(h.id) === -1; });
        ddList = html`<div class="dd" role="group" aria-label="Helfer wählen" onClick=${function (e) { e.stopPropagation(); }}>
          ${candidates.length === 0 ? html`<div class="free-txt" style=${{padding: '8px'}}>Keine Helfer angelegt.</div>` : null}
          ${candidates.map(function (h) {
            var s = d.stats[h.id];
            return html`<button key=${h.id} type="button" class="dd-row" onClick=${function () { assign(shift.id, h.id, false); }}>
              <span class="dd-dot" style=${{backgroundColor: h.color}}></span><span>${h.display_name}</span>
              <span class="dd-cnt">${s.c}/${s.tgt}</span>
            </button>`;
          })}
        </div>`;
      }
      return html`<div key=${shift.id} class=${'card ' + cls + (isMine ? ' mine' : '')} data-shift=${shift.id}>
        <div class="card-top">
          <div>
            <div class="card-tm">${shift.start_time}${isNight(shift) ? html`<span class="card-night">${nightNote(shift)}</span>` : null}</div>
            <button type="button" class="card-ty" aria-label=${'Infos zu ' + title} onClick=${function (e) { e.stopPropagation(); setDlg({type: 'info', key: shift.type_key, min: shift.duration_min}); }}>${title} · ${hrs(shift.duration_min)} h</button>
          </div>
          <span class=${'cap ' + cls} aria-label=${inIt.length + ' von ' + shift.capacity + ' besetzt'}>${inIt.length}/${shift.capacity}</span>
        </div>
        <div class="card-people">
          ${inIt.map(function (hid) {
            var h = d.hById[hid];
            if (!h) return null;
            return html`<span key=${hid} class=${'person' + (hid === me ? ' me' : '')} style=${{backgroundColor: h.color, color: tc(h.color)}}>
              ${h.display_name}${hid === me ? ' (du)' : ''}
              ${isAdmin ? html`<button type="button" class="rm" disabled=${off} aria-label=${h.display_name + ' aus ' + shift.start_time + ' ' + title + ' entfernen'}
                onClick=${function (e) { e.stopPropagation(); unassign(shift.id, hid); }}><span aria-hidden="true">×</span></button>` : null}
            </span>`;
          })}
        </div>
        <div class="card-swaps">${incoming.map(function (w) {
          return html`<div class="card-swap-in" key=${w.id}><strong>${nameOf(d, w.from_helper)}</strong> möchte hierher ${w.kind === 'move' ? 'wechseln' : 'tauschen'}</div>`;
        })}</div>
        ${myOut.length ? html`<div class="card-swap-out">Deine Anfrage läuft: ${myOut.map(function (w) { return shiftText(d, w.to_shift); }).join(', ')}${locked ? ' (Tausch gesperrt)' : ''}</div>` : null}
        ${isAdmin && !full ? html`<div class="slots"><div class="slot-row">${slotBtns}</div>${ddList}</div>` : null}
        ${isHelper && isMine ? (locked
          ? html`<div class="free-txt">Tausch ist gesperrt</div>`
          : html`<button type="button" class="swap-btn" disabled=${off} onClick=${function (e) { e.stopPropagation(); setDlg({type: 'swap', shiftId: shift.id}); }}>Tausch anfragen</button>`) : null}
        ${isHelper && !full && !isMine ? html`<div class="free-txt">${slots} ${slots === 1 ? 'Platz' : 'Plätze'} frei</div>` : null}
      </div>`;
    }

    function renderBoard() {
      var dupMap = {};
      dayShifts.forEach(function (s) { var k = s.start_time + '|' + s.type_key; (dupMap[k] = dupMap[k] || []).push(s.id); });
      var chips = null;
      if (isAdmin) {
        var sorted = d.helpers.slice().sort(function (a, b) {
          var sa = d.stats[a.id], sb2 = d.stats[b.id];
          var da = sa.c >= sa.tgt, db = sb2.c >= sb2.tgt;
          if (da !== db) return da ? 1 : -1;
          return sa.c - sb2.c;
        });
        chips = html`<div class="hbar-wrap">
          <div class="hbar">
            <div class="hbar-hint">Helfer wählen, dann einen freien Platz antippen</div>
            <div class="chips">
              ${sorted.length === 0 ? html`<span class="free-txt">Noch keine Helfer. Lege sie unter „Einstellungen“ an.</span>` : null}
              ${sorted.map(function (h) {
                var s = d.stats[h.id];
                var done = s.c >= s.tgt, picked = sel === h.id;
                return html`<button key=${h.id} type="button" class=${'chip' + (picked ? ' picked' : '') + (done ? ' done' : '')}
                  style=${{backgroundColor: h.color, color: tc(h.color)}} aria-pressed=${picked ? 'true' : 'false'}
                  onClick=${function (e) { e.stopPropagation(); setSel(picked ? null : h.id); setDd(null); }}
                  >${h.display_name} <span class="cnt">${s.c}/${s.tgt}</span>${done ? ' ✓' : ''}</button>`;
              })}
            </div>
          </div>
          ${sel ? html`<div class="assign-hint"><span>Zuweisen: <strong>${nameOf(d, sel)}</strong></span>
            <span class="btn-row"><button type="button" class="esc-btn" onClick=${function () { setDlg({type: 'helper', id: sel}); }}>Details</button>
            <button type="button" class="esc-btn" onClick=${function () { setSel(null); }}>Auswahl aufheben</button></span></div>` : null}
        </div>`;
      }
      return html`<div>
        ${chips}
        <div class="board">
          <div class="grid" key=${day}>${dayShifts.map(function (s) { return renderCard(s, dupMap); })}</div>
          ${dayShifts.length === 0 ? html`<p class="empty-msg">Für diesen Tag gibt es keine Schichten.</p>` : null}
        </div>
      </div>`;
    }

    // ----- Mein Plan -----
    function renderMyPlan() {
      var h = d.hById[me];
      if (!h) return null;
      var s = d.stats[me];
      return html`
        <div class="my-plan">
          <h2>Mein Helferplan</h2>
          <${MyMail} key=${me} act=${act} disabled=${off} />
          <div class="me-box">
            <div class="me-av" style=${{backgroundColor: h.color}}></div>
            <div>
              <div class="me-nm">${h.display_name}</div>
              <div class="me-sub">${s.c} ${s.c === 1 ? 'Schicht' : 'Schichten'} · ${hrs(s.min)} h${s.c >= s.tgt ? ' ✓' : ''}</div>
            </div>
          </div>
          ${locked ? html`<div class="notice warn" style=${{margin: '0 0 14px'}}><span>Der Tausch ist gesperrt. Wenn du eine Schicht nicht übernehmen kannst, melde dich direkt bei der Orga.</span></div>` : null}
          <div>${DAYS.map(function (day2) {
            var list = d.shifts.filter(function (x) { return x.day === day2.id && (d.byShift[x.id] || []).indexOf(me) !== -1; });
            return html`<div class="plan-day" key=${day2.id}>
              <div class="plan-day-label">${day2.name} (${day2.lb})</div>
              ${list.length === 0 ? html`<div class="plan-free">— frei —</div>` : null}
              <div>${list.map(function (x) {
                return html`<div class="plan-shift" key=${x.id} data-shift=${x.id}>
                  <div class="ps-time">${x.start_time}</div>
                  <div class="ps-info">
                    <div class="ps-type">${gst(x.type_key).n}</div>
                    <div class="ps-dur">${hrs(x.duration_min)} Stunden${isNight(x) ? ' · ' + nightNote(x) : ''}</div>
                    ${(d.myPendingFrom[x.id] || []).length ? html`<div class="ps-swap">Tausch angefragt: ${d.myPendingFrom[x.id].map(function (w) { return shiftText(d, w.to_shift); }).join(', ')}</div>` : null}
                  </div>
                  ${locked ? null : html`<button type="button" class="swap-btn" disabled=${off} onClick=${function () { setDlg({type: 'swap', shiftId: x.id}); }}>Tausch</button>`}
                </div>`;
              })}</div>
            </div>`;
          })}</div>
          <p class="plan-tip">Tipp: Mach vor dem Wochenende ein Bildschirmfoto von deinem Plan. Dann hast du ihn auch ohne Netz.</p>
        </div>`;
    }

    // ----- Tausch -----
    function swapLine(w) {
      return html`<div>
        <div class="sw-detail">${shiftText(d, w.from_shift)} <span aria-hidden="true">→</span><span class="sr-only"> gegen </span> ${shiftText(d, w.to_shift)}${w.kind === 'move' ? ' (freier Platz)' : ''}</div>
        ${w.note ? html`<div class="sw-note">„${w.note}“</div>` : null}
      </div>`;
    }
    function statusEl(w) {
      var txt = STATUS_TXT[w.status] || w.status;
      if (w.status === 'pending') txt = locked ? 'Offen, Tausch gesperrt' : (w.kind === 'move' ? 'Wartet auf die Orga' : 'Wartet auf Antwort');
      if (w.status === 'accepted' && w.kind === 'move') txt = 'Freigegeben';
      return html`<span class=${'sw-status st-' + w.status}>${txt}</span>`;
    }
    function renderMySwaps() {
      return html`
        <div class="swap-list">
          <h2>Mein Tausch</h2>
          ${d.incoming.length === 0 && d.mySwaps.length === 0 ? html`<p class="empty-msg">Noch keine Tauschanfragen. Du startest eine unter „Mein Plan“ oder auf dem Board bei deiner Schicht.</p>` : null}
          ${d.incoming.length > 0 ? html`<div class="sec-label">Anfragen an mich</div>` : null}
          <div>${d.incoming.map(function (w) {
            var from = d.hById[w.from_helper] || {};
            return html`<div class="sw-card" key=${w.id} data-swap=${w.id}>
              <div class="sw-dot" style=${{backgroundColor: from.color || '#ccc'}}></div>
              <div class="sw-info"><div><strong>${nameOf(d, w.from_helper)}</strong> möchte mit dir tauschen</div>${swapLine(w)}</div>
              <div class="sw-actions">
                <button type="button" class="sw-act sw-yes" disabled=${off || locked} onClick=${function () { askAccept(w); }}>Annehmen</button>
                <button type="button" class="sw-act sw-no" disabled=${off} onClick=${function () { rejectSwap(w); }}>Ablehnen</button>
              </div>
            </div>`;
          })}</div>
          ${d.mySwaps.length > 0 ? html`<div class="sec-label">Meine Anfragen</div>` : null}
          <div>${d.mySwaps.map(function (w) {
            return html`<div class="sw-card" key=${w.id} data-swap=${w.id}>
              <div class="sw-info">${swapLine(w)}</div>
              ${statusEl(w)}
              ${w.status === 'pending' ? html`<div class="sw-actions"><button type="button" class="sw-act sw-no" disabled=${off} onClick=${function () { cancelSwap(w); }}>Zurückziehen</button></div>` : null}
            </div>`;
          })}</div>
        </div>`;
    }
    function renderAdminSwaps() {
      return html`
        <div class="swap-list">
          <h2>Tauschvorgänge</h2>
          ${d.swaps.length === 0 ? html`<p class="empty-msg">Keine Tauschvorgänge.</p>` : null}
          <div>${d.swaps.map(function (w) {
            var from = d.hById[w.from_helper] || {};
            var waitFor = (d.byShift[w.to_shift] || []).filter(function (id) { return id !== w.from_helper; }).map(function (id) { return nameOf(d, id); }).join(', ');
            return html`<div class="sw-card" key=${w.id} data-swap=${w.id}>
              <div class="sw-dot" style=${{backgroundColor: from.color || '#ccc'}}></div>
              <div class="sw-info">
                <div><strong>${nameOf(d, w.from_helper)}</strong> ${w.kind === 'move' ? 'möchte auf einen freien Platz wechseln' : 'möchte tauschen'}</div>
                ${swapLine(w)}
                ${w.status === 'pending' && w.kind === 'swap' && waitFor ? html`<div class="sw-detail">Annehmen kann: ${waitFor}</div>` : null}
                ${w.status === 'accepted' && w.accepted_by ? html`<div class="sw-detail">Angenommen von ${nameOf(d, w.accepted_by)}</div>` : null}
              </div>
              ${statusEl(w)}
              ${w.status === 'pending' ? html`<div class="sw-actions">
                ${w.kind === 'move' ? html`<button type="button" class="sw-act sw-yes" disabled=${off || locked} onClick=${function () { approveMove(w); }}>Freigeben</button>` : null}
                <button type="button" class="sw-act sw-no" disabled=${off} onClick=${function () { rejectSwap(w); }}>Ablehnen</button>
              </div>` : null}
            </div>`;
          })}</div>
        </div>`;
    }

    // ----- Hinweise -----
    function noteText(n) {
      if (n.kind === 'assigned') return {head: 'Schicht zugewiesen', body: 'Die Orga hat dir diese Schicht zugewiesen: ' + shiftText(d, n.shift_id) + '.'};
      if (n.kind === 'unassigned') return {head: 'Schicht entfernt', body: 'Die Orga hat dich aus dieser Schicht entfernt: ' + shiftText(d, n.shift_id) + '.'};
      var w = d.swById[n.swap_id];
      if (!w) return {head: 'Tausch', body: 'Der zugehörige Vorgang ist nicht mehr vorhanden.'};
      var line = shiftText(d, w.from_shift) + ' gegen ' + shiftText(d, w.to_shift);
      var iAsked = w.from_helper === me;
      if (n.kind === 'swap_request') return {head: 'Tausch-Anfrage', body: nameOf(d, w.from_helper) + ' möchte mit dir tauschen: ' + line + '. Antworten kannst du unter „Mein Tausch“.' + (w.status !== 'pending' ? ' Stand: ' + (STATUS_TXT[w.status] || w.status) + '.' : '')};
      if (n.kind === 'swap_accepted') return {head: w.kind === 'move' ? 'Wechsel freigegeben' : 'Tausch durchgeführt', body: iAsked
        ? 'Deine Anfrage ' + line + ' ist durch. Du hast jetzt ' + shiftText(d, w.to_shift) + '.'
        : 'Du hast mit ' + nameOf(d, w.from_helper) + ' getauscht. Du hast jetzt ' + shiftText(d, w.from_shift) + '.'};
      if (n.kind === 'swap_rejected') return {head: 'Tausch abgelehnt', body: 'Deine Anfrage ' + line + ' wurde abgelehnt. Dein Plan bleibt, wie er war.'};
      if (n.kind === 'swap_expired') return {head: 'Anfrage verfallen', body: 'Deine Anfrage ' + line + ' ist verfallen, weil sich der Plan inzwischen geändert hat.'};
      return {head: 'Tausch', body: line};
    }
    function renderInbox() {
      return html`
        <div class="inbox">
          <h2>Hinweise</h2>
          <${MyMail} key=${me} act=${act} disabled=${off} />
          ${d.notifications.length === 0 ? html`<p class="empty-msg">Keine Hinweise. Hier erscheinen Rückmeldungen zu deinen Tauschanfragen.</p>` : null}
          <div>${d.notifications.map(function (n) {
            var t = noteText(n);
            return html`<div class=${'msg-card' + (n.read_at ? '' : ' unread')} key=${n.id}>
              <div class="msg-head"><div class="msg-from">${t.head}</div><div class="msg-time">${fmtDT(n.created_at)}</div></div>
              <div class="msg-body">${t.body}</div>
            </div>`;
          })}</div>
        </div>`;
    }

    // ----- Helfer -----
    function renderHelpers() {
      return html`
        <div class="h-overview">
          ${d.helpers.length === 0 ? html`<p class="empty-msg">Noch keine Helfer angelegt.</p>` : null}
          <div class="h-grid">
            ${d.helpers.map(function (h) {
              var s = d.stats[h.id];
              var pct = s.tgtMin > 0 ? Math.min(100, s.min / s.tgtMin * 100) : 100;
              var col = pct >= 100 ? 'var(--green)' : (pct >= 50 ? 'var(--orange)' : 'var(--red)');
              return html`<button key=${h.id} type="button" class=${'h-card' + (h.id === me ? ' me' : '')} onClick=${function () { setDlg({type: 'helper', id: h.id}); }}>
                <span class="h-av" style=${{backgroundColor: h.color}}></span>
                <span class="h-main">
                  <span class="h-nm">${h.display_name}${h.id === me ? ' (du)' : ''}${h.is_setup_team ? html` <span class="h-tag">Aufbau</span>` : null}</span>
                  <span class="h-sub">${s.c} Schichten · ${hrs(s.min)} h von ${hrs(s.tgtMin)} h</span>
                  <span class="h-bar-wrap"><span class="h-bar-bg"><span class="h-bar-fill" style=${{width: pct + '%', backgroundColor: col}}></span></span>
                    <span class="h-bar-txt" style=${{color: col}}>${pct >= 100 ? '✓' : hrs(s.tgtMin - s.min) + ' h'}</span></span>
                </span>
              </button>`;
            })}
          </div>
        </div>`;
    }

    // ----- Anleitungen -----
    function renderHowto() {
      return html`
        <div class="howto">
          <h2>Anleitungen</h2>
          <div>${HOWTOS.map(function (ht, i) {
            var open = htOpen === i;
            return html`<div class="howto-card" key=${i}>
              <button type="button" class="howto-head" aria-expanded=${open ? 'true' : 'false'} onClick=${function () { setHtOpen(open ? null : i); }}>
                <span>${ht.icon} ${ht.title}</span><span class="howto-arrow" aria-hidden="true">${open ? '▲' : '▼'}</span>
              </button>
              ${open ? html`<div class="howto-body" dangerouslySetInnerHTML=${{__html: ht.body}}></div>` : null}
            </div>`;
          })}</div>
        </div>`;
    }

    // ----- Einstellungen (Orga) -----
    function renderSettings() {
      var testNames = d.allHelpers.filter(function (h) { return h.is_test; }).map(function (h) { return h.display_name; });
      var hasTest = testNames.length > 0;
      var hasLogins = d.allHelpers.some(function (h) { return h.has_login; });
      return html`
        <div class="settings">
          <${SettingsForms} d=${d} act=${act} disabled=${off} />
          <div class="s-block">
            <h3>Alle Helfer (${d.allHelpers.length})</h3>
            ${d.allHelpers.length === 0 ? html`<div class="s-note">Noch keine Helfer.</div>` : null}
            <div>${d.allHelpers.map(function (h) {
              var s = d.stats[h.id];
              var login = h.has_login ? ('Link vom ' + fmtDT(h.login_code_created_at) + (h.signed_in ? ', angemeldet' : ', noch nicht geöffnet')) : 'kein Login-Link';
              return html`<div class=${'mini-h' + (h.active ? '' : ' off')} key=${h.id} data-helper=${h.display_name}>
                <div class="mini-dot" style=${{backgroundColor: h.color}}></div>
                <div class="mini-main">
                  <span class="mini-nm">${h.display_name}</span>
                  ${h.is_setup_team ? html`<span class="tag">Aufbau</span>` : null}
                  ${h.is_test ? html`<span class="tag test">Test</span>` : null}
                  ${h.active ? null : html`<span class="tag off">deaktiviert</span>`}
                  <span class="mini-sub">${s.c} Schichten · ${hrs(s.min)} h · ${h.contact_channel || 'kein Kontaktweg'} · ${login}</span>
                </div>
                <${HelperMail} id=${h.id} act=${act} disabled=${off} />
                ${h.active ? html`<div class="mini-acts" key="on">
                    <button type="button" class="btn btn-ghost btn-sm" disabled=${off} onClick=${function () { setDlg({type: 'edit', helper: h}); }}>Bearbeiten</button>
                    <button type="button" class="btn btn-gold btn-sm" disabled=${off} onClick=${function () { newLink(h); }}>${h.has_login ? 'Login-Link erneuern' : 'Login-Link erzeugen'}</button>
                    ${h.has_login ? html`<button type="button" class="btn btn-ghost btn-sm" disabled=${off} onClick=${function () {
                      setDlg({type: 'confirm', danger: true, title: 'Login-Link sperren?', text: h.display_name + ' kann den Plan danach nicht mehr öffnen, bis du einen neuen Link erzeugst.', yes: 'Sperren',
                        onYes: function () { setDlg(null); act('hp_admin_revoke_login', {p_helper: h.id}, {okText: 'Login-Link gesperrt.'}); }});
                    }}>Link sperren</button>` : null}
                    <button type="button" class="btn btn-ghost btn-sm" disabled=${off} onClick=${function () { deactivate(h); }}>Deaktivieren</button>
                  </div>` : html`<div class="mini-acts" key="off">
                    <button type="button" class="btn btn-ghost btn-sm" disabled=${off} onClick=${function () { act('hp_admin_reactivate_helper', {p_helper: h.id}, {okText: h.display_name + ' ist wieder aktiv.'}); }}>Reaktivieren</button>
                  </div>`}
              </div>`;
            })}</div>
          </div>
          <div class="s-block">
            <h3>Plan sichern und drucken</h3>
            <div class="s-note">Der Ausdruck ist die Notfallfassung für den Fall, dass am Event kein Netz da ist.</div>
            <div class="btn-row">
              <button type="button" class="btn btn-ghost" onClick=${function () { setView('print'); }}>Druckansicht</button>
              <button type="button" class="btn btn-ghost" onClick=${function () {
                setDlg({type: 'confirm', title: 'Plan als Datei sichern', text: 'Die Datei enthält die Namen aller Helfer. Bewahre sie nur auf deinem eigenen Gerät auf und lösche sie nach dem Event.', yes: 'Datei speichern',
                  onYes: function () { setDlg(null); doExport(); }});
              }}>Plan als Datei sichern</button>
            </div>
          </div>
          <div class="s-block">
            <h3>Testdaten und Löschung</h3>
            <div class="s-note">Löschtermin laut Einstellung: ${fmtDay(d.settings.purge_after) || 'nicht gesetzt'}. Vorher den Plan als Datei sichern.</div>
            <div class="btn-row">
              <button type="button" class="btn btn-ghost" disabled=${off || !hasTest} onClick=${function () {
                setDlg({type: 'confirm', danger: true, title: 'Testdaten entfernen?', text: 'Entfernt ' + testNames.length + ' Testhelfer samt Zuweisungen, Tausch und Login-Links: ' + testNames.join(', ') + '. Alle anderen Helfer bleiben unberührt.', yes: 'Testdaten entfernen',
                  onYes: function () { setDlg(null); act('hp_admin_remove_test_data', {}, {okText: function (r) { return r.removed + ' Testhelfer entfernt.'; }}); }});
              }}>Testdaten entfernen</button>
              <button type="button" class="btn btn-ghost" disabled=${off || !hasLogins} onClick=${function () {
                setDlg({type: 'confirm', danger: true, title: 'Alle Login-Links sperren?', text: 'Danach kann kein Helfer den Plan mehr öffnen. Gedacht für die Zeit nach dem Event.', yes: 'Alle sperren',
                  onYes: function () { setDlg(null); act('hp_admin_revoke_login', {p_helper: null}, {okText: function (r) { return r.revoked + ' Login-Links gesperrt.'; }}); }});
              }}>Alle Login-Links sperren</button>
              <button type="button" class="btn btn-red" disabled=${off || d.allHelpers.length === 0} onClick=${function () { setDlg({type: 'purge'}); }}>Helferdaten löschen</button>
            </div>
          </div>
          <div class="s-block">
            <h3>Mein Orga-Konto</h3>
            <${PasswordForm} disabled=${!conn.ok} />
          </div>
        </div>`;
    }

    // ----- Druckansicht -----
    function renderPrint() {
      return html`
        <div class="print-view">
          <div class="btn-row no-print" style=${{marginBottom: '14px'}}>
            <button type="button" class="btn btn-gold" onClick=${function () { window.print(); }}>Drucken</button>
            <button type="button" class="btn btn-ghost" onClick=${function () { setView(isAdmin ? 'settings' : 'board'); }}>Zurück</button>
          </div>
          <h2>Bendito Helferplan</h2>
          <div class="print-meta">Stand ${conn.at ? fmtDT(conn.at.toISOString()) : ''} · ${d.total.fil} von ${d.total.tot} Plätzen besetzt</div>
          <div>${DAYS.map(function (day2) {
            var list = d.shifts.filter(function (s) { return s.day === day2.id; });
            return html`<section key=${day2.id}><h3>${day2.name}</h3>
              <table class="ptable">
                <thead><tr><th scope="col">Zeit</th><th scope="col">Schicht</th><th scope="col">Dauer</th><th scope="col">Wer</th></tr></thead>
                <tbody>${list.map(function (s) {
                  var names = (d.byShift[s.id] || []).map(function (id) { return nameOf(d, id); });
                  var open = s.capacity - names.length;
                  return html`<tr key=${s.id}><td>${s.start_time}${isNight(s) ? ' (' + nightNote(s) + ')' : ''}</td><td>${gst(s.type_key).n}</td><td>${hrs(s.duration_min)} h</td>
                    <td>${names.join(', ')}${open > 0 ? html`<span class="open">${names.length ? ' · ' : ''}${open} offen</span>` : null}</td></tr>`;
                })}</tbody>
              </table></section>`;
          })}</div>
          <h3>Je Helfer</h3>
          <table class="ptable">
            <thead><tr><th scope="col">Name</th><th scope="col">Kontaktweg</th><th scope="col">Schichten</th></tr></thead>
            <tbody>${d.helpers.map(function (h) {
              var ids = (d.byHelper[h.id] || []).slice().sort(function (a, b) { return d.sById[a].start_min - d.sById[b].start_min; });
              return html`<tr key=${h.id}><td>${h.display_name}</td><td>${h.contact_channel || ''}</td><td>${ids.map(function (id) { return shiftText(d, id); }).join(' · ')}</td></tr>`;
            })}</tbody>
          </table>
        </div>`;
    }

    // ----- Dialoge -----
    function renderDialog() {
      if (!dlg) return null;
      var close = function () { setDlg(null); };
      if (dlg.type === 'confirm') return html`<${ConfirmDialog} title=${dlg.title} text=${dlg.text} yes=${dlg.yes} danger=${dlg.danger} onYes=${dlg.onYes} onClose=${close} />`;
      if (dlg.type === 'info') {
        return html`<${Dialog} title=${gst(dlg.key).n} onClose=${close}>
          <div class="info-dur">${hrs(dlg.min)} Stunden</div>
          <div class="info-body" dangerouslySetInnerHTML=${{__html: gst(dlg.key).info || 'Keine weiteren Infos verfügbar.'}}></div>
        <//>`;
      }
      if (dlg.type === 'swap') {
        var from = d.sById[dlg.shiftId];
        if (!from || (d.byShift[from.id] || []).indexOf(me) === -1) return null;
        return html`<${SwapForm} d=${d} from=${from} disabled=${off} onSubmit=${requestSwap} onClose=${close} />`;
      }
      if (dlg.type === 'edit') {
        return html`<${HelperForm} helper=${dlg.helper} disabled=${off} onClose=${close}
          onSubmit=${function (args) { act('hp_admin_upsert_helper', args, {okText: 'Gespeichert.', onOk: close}); }} />`;
      }
      if (dlg.type === 'privacy') {
        var until = fmtDay(d.settings.purge_after);
        return html`<${Dialog} title="Datenschutz" onClose=${close}>
          <p class="dlg-p"><strong>Was gespeichert wird:</strong> dein Anzeigename, eine Farbe, dein bevorzugter Kontaktweg (ohne Nummer oder Adresse), ob du zum Aufbau-Team gehörst, deine Schichten und deine Tauschanfragen samt Notiz. Wer das Formular „Mithilfe anbieten“ ausfüllt, speichert zusätzlich Name, E-Mail, Telefon, die Antworten zu Donnerstag, Montag, Pre-Milonga und Abschlussessen sowie eine Anmerkung. Diese Antworten sieht nur die Orga.</p>
          <p class="dlg-p">Deine Mailadresse speichern wir nur für Benachrichtigungen zu Tausch und Schichtänderungen. Die Mails kommen über das Bendito-Gmail. Du kannst sie unter „Mein Plan“ jederzeit abschalten. Deine Mailadresse löschen wir spätestens am 15.11.2026.</p>
          <p class="dlg-p"><strong>Wer es sieht:</strong> Name, Farbe, Kontaktweg, Aufbau-Team und Schichten sehen alle Helfer mit persönlichem Link und die Orga. Tauschanfragen sehen nur die Beteiligten und die Orga.</p>
          <p class="dlg-p"><strong>Technisch dazu:</strong> ein Protokoll ohne Namen, wann welche Aktion lief. Beim Öffnen eines Links wird für etwa einen Tag eine Prüfsumme der Internetadresse gespeichert, um Ausprobieren zu bremsen. Die Adresse selbst wird nicht gespeichert.</p>
          <p class="dlg-p"><strong>Wo es liegt:</strong> auf dem eigenen Server in Nürnberg. Die Seite selbst kommt von GitHub Pages.</p>
          <p class="dlg-p"><strong>Auf deinem Gerät:</strong> deine Anmeldung, zwei Anzeige-Einstellungen und, sobald die Orga es eingibt, das Passwort für die Kuchen-Meldungen. Keine Statistik, keine Werbung. Dieses Passwort bleibt im Browser und wird nicht bei jedem Seitenaufruf mitgeschickt. Den Login-Link kann die Orga als Entwurf in ihr eigenes Mailprogramm legen. Die App verschickt diese Mail nicht.</p>
          <p class="dlg-p"><strong>Löschung:</strong> Nach dem Event werden die Login-Links gesperrt und die Helferdaten${until ? ' bis zum ' + until : ''} aus der App gelöscht. Die Orga sichert den Plan vorher als Datei auf ihrem eigenen Gerät.</p>
          <p class="dlg-p">Fragen, Auskunft oder Löschwunsch: bitte direkt an die Orga.</p>
          <div class="dlg-actions"><button type="button" class="btn btn-ghost" data-autofocus="1" onClick=${close}>Schließen</button></div>
        <//>`;
      }
      if (dlg.type === 'link') return html`<${LinkDialog} name=${dlg.name} url=${dlg.url} onClose=${close} />`;
      if (dlg.type === 'purge') {
        return html`<${PurgeDialog} disabled=${off} onExport=${doExport} onClose=${close}
          onPurge=${function () { setDlg(null); act('hp_admin_purge', {p_confirm: 'LOESCHEN'}, {
            okText: function (r) {
              var t = 'Gelöscht: ' + r.helpers + ' Helfer, ' + r.assignments + ' Zuweisungen, ' + r.swaps + ' Tauschvorgänge.';
              if (r.offers) t += ' ' + r.offers + ' Mithilfe-Antworten.';
              return t;
            },
            onOk: function (r) {
              if (r.auth_left > 0) setNotice({type: 'err', text: 'Die Helferdaten sind gelöscht, aber ' + r.auth_left + ' Anmeldekonten ließen sich nicht entfernen. Bitte im Supabase-Dashboard unter „Authentication“ die Konten mit der Adresse hp-…@helfer.bendito.invalid von Hand löschen.'});
            }
          }); }} />`;
      }
      if (dlg.type === 'helper') {
        var h = d.hById[dlg.id];
        if (!h) return null;
        var s = d.stats[h.id];
        var pct = s.tgtMin > 0 ? Math.min(100, s.min / s.tgtMin * 100) : 100;
        return html`<${Dialog} title=${h.display_name} onClose=${close}>
          <div class="pop-head">
            <div class="pop-av" style=${{backgroundColor: h.color}}></div>
            <div>
              ${h.is_setup_team ? html`<div class="pop-tag">Aufbau-Team</div>` : null}
              <div class="pop-tag">${h.contact_channel ? 'Am liebsten erreichbar über ' + h.contact_channel : 'Kein Kontaktweg hinterlegt'}</div>
            </div>
          </div>
          <div class="pop-stats">
            <div class="pop-s"><div class="v">${s.c}</div><div class="l">Schichten</div></div>
            <div class="pop-s"><div class="v">${hrs(s.min)} h</div><div class="l">Stunden</div></div>
            <div class="pop-s"><div class="v">${pct >= 100 ? '✓' : hrs(s.tgtMin - s.min) + ' h'}</div><div class="l">${pct >= 100 ? 'Erreicht' : 'Offen'}</div></div>
          </div>
          <div>${DAYS.map(function (day2) {
            var list = d.shifts.filter(function (x) { return x.day === day2.id && (d.byShift[x.id] || []).indexOf(h.id) !== -1; });
            return html`<div class="pop-day" key=${day2.id}>
              <div class="pop-dn">${day2.name}</div>
              ${list.length === 0 ? html`<div class="pop-free">—</div>` : null}
              <div>${list.map(function (x) {
                return html`<div class="pop-sh" key=${x.id}>${x.start_time}${isNight(x) ? ' (' + nightNote(x) + ')' : ''} — ${gst(x.type_key).n} (${hrs(x.duration_min)} h)</div>`;
              })}</div>
            </div>`;
          })}</div>
          <div class="dlg-actions"><button type="button" class="btn btn-ghost" onClick=${close}>Schließen</button></div>
        <//>`;
      }
      return null;
    }

    function renderCakes() {
      var labels = {vegan: 'vegan', glutenfrei: 'glutenfrei', laktosefrei: 'laktosefrei', nuesse: 'enthält Nüsse', alkohol: 'enthält Alkohol'};
      var saved = '';
      try { saved = localStorage.getItem('kb-team-pass') || ''; } catch (e) {}
      function notes(c) {
        var bits = [c.kind === 'herzhaft' ? 'Herzhaft' : 'Süß'];
        (c.labels || []).forEach(function (key) { if (labels[key]) bits.push(labels[key]); });
        if (c.cooling) bits.push('Kühlschrank');
        if (c.pieces) bits.push('ca. ' + c.pieces + ' Stücke');
        return bits.join(' · ');
      }
      var groups = [];
      var bySlot = {};
      (teamCakes || []).forEach(function (c) {
        var title = c.slot_label || 'Termin';
        if (!bySlot[title]) { bySlot[title] = []; groups.push(title); }
        bySlot[title].push(c);
      });
      return html`<div class="offers">
        <h2>Kuchen nur fürs Team</h2>
        <p class="s-note">Das sind die Meldungen, die nicht in der Gästeliste stehen. Das Passwort bleibt auf diesem Gerät, bis du es hier vergisst.</p>
        ${saved ? html`<div class="btn-row">
          <button type="button" class="btn btn-gold" disabled=${teamBusy} onClick=${function () { loadTeamCakes(saved); }}>Neu laden</button>
          <button type="button" class="btn btn-ghost" onClick=${function () {
            try { localStorage.removeItem('kb-team-pass'); } catch (e) {}
            setTeamCakes(null); setTeamErr(''); setTeamPw('');
          }}>Passwort auf diesem Gerät vergessen</button>
        </div>` : html`<form onSubmit=${function (e) {
          e.preventDefault();
          if (!teamBusy && teamPw) loadTeamCakes(teamPw);
        }}>
          <div class="field">
            <label for="kb-team-pw">Passwort</label>
            <input id="kb-team-pw" type="password" autocomplete="off" value=${teamPw} onInput=${function (e) { setTeamPw(e.target.value); }} />
          </div>
          <button type="submit" class="btn btn-gold" disabled=${teamBusy || !teamPw}>Anzeigen</button>
        </form>`}
        ${teamErr ? html`<p class="empty-msg" role="alert">${teamErr}</p>` : null}
        ${teamBusy && !teamCakes ? html`<p class="empty-msg">Wird geladen …</p>` : null}
        ${teamCakes && teamCakes.length === 0 ? html`<p class="empty-msg">Noch keine Meldung nur ans Team.</p>` : null}
        ${groups.map(function (title) {
          return html`<section key=${title}>
            <h3>${title}</h3>
            ${bySlot[title].map(function (c) {
              return html`<article class="offer-card" key=${c.id}>
                <h3>${c.cake}</h3>
                <div class="mini-sub">${c.name} · ${notes(c)}</div>
                <p>${c.dropoff || ''}</p>
                ${c.note ? html`<p>${c.note}</p>` : null}
              </article>`;
            })}
          </section>`;
        })}
      </div>`;
    }

    function renderOffers() {
      var rows = offers || [];
      var choice = {ja: 'Ja', nein: 'Nein', vielleicht: 'Mal sehen'};
      function n(key, val) { return rows.filter(function (o) { return o[key] === val; }).length; }
      function line(label, value) { return label + ': ' + (choice[value] || '–'); }
      return html`<div class="offers">
        <h2>Mithilfe und Aufenthalt</h2>
        <p class="s-note">Wer schon am Donnerstag kommt, bis Montag bleibt, bei der Pre-Milonga oder beim Abschlussessen dabei ist. Das Formular ist offen, die Antworten sieht nur die Orga.</p>
        <div class="offer-counts">
          <span>${rows.length} Rückmeldungen</span>
          <span>Donnerstag ja: ${n('arrive_thu', 'ja')}</span>
          <span>Montag ja: ${n('stay_mon', 'ja')}</span>
          <span>Pre-Milonga ja: ${n('pre_milonga', 'ja')}</span>
          <span>Abschlussessen ja: ${n('dinner_sun', 'ja')}</span>
        </div>
        <div class="btn-row">
          <button type="button" class="btn btn-gold" onClick=${loadOffers}>Neu laden</button>
          <a class="btn btn-ghost" href="mithilfe.html">Formular öffnen</a>
        </div>
        ${offersErr ? html`<p class="empty-msg">${offersErr}</p>` : null}
        ${!offersErr && offers && rows.length === 0 ? html`<p class="empty-msg">Noch keine Rückmeldung.</p>` : null}
        ${rows.map(function (o, index) {
          return html`<article class="offer-card" key=${o.email}>
            <h3>${index + 1}. ${o.name}</h3>
            <div class="mini-sub">${o.email}${o.phone ? ' · ' + o.phone : ''} · ${fmtDT(o.updated_at)}</div>
            <ul>
              <li>${line('Donnerstag, 29.10.', o.arrive_thu)}</li>
              <li>${line('Montag, 2.11.', o.stay_mon)}</li>
              <li>${line('Pre-Milonga', o.pre_milonga)}</li>
              <li>${line('Abschlussessen Sonntag', o.dinner_sun)}</li>
            </ul>
            ${o.note ? html`<p>${o.note}</p>` : null}
            ${o.id ? html`<${OfferReply} key=${o.id + ':' + (o.reply_revision || 0)} offer=${o} />` : null}
          </article>`;
        })}
      </div>`;
    }

    // ----- Rahmen -----
    var tabs = [['board', 'Board', 0]];
    if (isHelper) tabs.push(['myplan', 'Mein Plan', 0]);
    tabs.push(['helpers', 'Helfer', 0], ['howto', 'Anleitungen', 0]);
    if (isAdmin) tabs.push(['cakes', 'Kuchen', teamCakes ? teamCakes.length : 0], ['offers', 'Mithilfe', offers ? offers.length : 0], ['swaps', 'Tausch', d.pendingMoves.length], ['settings', 'Einstellungen', 0]);
    if (isHelper) tabs.push(['myswaps', 'Mein Tausch', d.incoming.length], ['inbox', 'Hinweise', d.unread]);
    var known = tabs.some(function (t) { return t[0] === view; }) || (view === 'print' && isAdmin);
    var cur = known ? view : 'board';

    var body = null;
    if (cur === 'board') body = renderBoard();
    else if (cur === 'myplan') body = renderMyPlan();
    else if (cur === 'helpers') body = renderHelpers();
    else if (cur === 'howto') body = renderHowto();
    else if (cur === 'cakes') body = renderCakes();
    else if (cur === 'offers') body = renderOffers();
    else if (cur === 'swaps') body = renderAdminSwaps();
    else if (cur === 'settings') body = renderSettings();
    else if (cur === 'myswaps') body = renderMySwaps();
    else if (cur === 'inbox') body = renderInbox();
    else if (cur === 'print') body = renderPrint();

    // Erinnerung für die Orga nach dem Event.
    var reminder = null;
    if (isAdmin && d.allHelpers.length > 0) {
      var purgeTxt = fmtDay(d.settings.purge_after) || 'laut Einstellung';
      var purgeDue = !!fmtDay(d.settings.purge_after) && d.serverNow >= new Date(d.settings.purge_after + 'T00:00:00');
      var eventOver = d.settings.event_end && d.serverNow > new Date(d.settings.event_end);
      var linksOpen = d.allHelpers.some(function (h) { return h.has_login; });
      if (purgeDue) reminder = 'Der Löschtermin (' + purgeTxt + ') ist erreicht. Bitte den Plan als Datei sichern und danach die Helferdaten löschen.';
      else if (eventOver && linksOpen) reminder = 'Das Event ist vorbei. Bitte alle Login-Links sperren und bis zum ' + purgeTxt + ' die Helferdaten löschen.';
      else if (eventOver) reminder = 'Das Event ist vorbei. Bitte bis zum ' + purgeTxt + ' den Plan als Datei sichern und die Helferdaten löschen.';
    }

    // Meldungen: am Bildschirmrand, oder direkt unter einem offenen Dialog.
    var toastStack = html`<div class="toasts">
      ${conn.ok ? null : html`<div class="notice err toast" data-toast="conn">
        <span>Keine Verbindung. Du siehst den Stand von ${conn.at ? fmtClock(conn.at) : 'vorhin'}, Änderungen sind gesperrt.</span>
        <button type="button" onClick=${function () { refresh(); }}>Erneut versuchen</button></div>`}
      ${notice ? html`<div class=${'notice toast ' + notice.type} data-toast="notice" role=${notice.type === 'err' ? 'alert' : 'status'}>
        <span>${notice.text}</span><button type="button" onClick=${function () { setNotice(null); }}>Schließen</button></div>` : null}
    </div>`;
    toastSlot = (!conn.ok || notice) ? toastStack : null;
    var dialogEl = renderDialog();

    var meHelper = me ? d.hById[me] : null;
    var statusText = conn.ok
      ? 'Stand ' + (conn.at ? fmtClock(conn.at) : '–')
      : 'Keine Verbindung – letzter Stand ' + (conn.at ? fmtClock(conn.at) : 'unbekannt') + ', Änderungen gesperrt';

    return html`
      <div onClick=${function () { if (dd) setDd(null); }}>
        <header class="header">
          <div class="logo-wrap">
            <img src=${LOGO} class="logo-img" alt="Bendito Tango Marathon" />
            <div class="header-sub">Helferplan</div>
          </div>
          <div class="header-right">
            <a class="hbtn back-to-app" href=${BENDITO_APP} referrerpolicy="no-referrer">← Zur Bendito-App</a>
            ${isAdmin ? html`<div class="stat-pill"><span><b>${d.total.fil}</b>/${d.total.tot} belegt · <b>${d.total.pct}%</b></span></div>` : null}
            ${meHelper ? html`<div class="stat-pill"><span><b>${d.stats[me].c}</b>/${d.stats[me].tgt} Schichten</span></div>` : null}
            <div class=${'who ' + (isAdmin ? 'on-a' : 'on-h')}>${isAdmin ? 'Orga' : (meHelper ? meHelper.display_name : '')}</div>
            <button type="button" class="hbtn" onClick=${logout}>Abmelden</button>
          </div>
        </header>
        <div class=${'status ' + (conn.ok ? 'ok' : 'bad')} role="status" aria-live="polite" data-conn=${conn.ok ? 'ok' : 'offline'}>
          <span class="dot" aria-hidden="true"></span><span>${statusText}</span>
          ${conn.ok ? null : html`<button type="button" class="status-btn" onClick=${function () { refresh(); }}>Erneut versuchen</button>`}
        </div>
        ${d.serverNow < new Date('2026-10-30T15:00:00+01:00') ? html`<section class="team-meeting" aria-labelledby="team-meeting-title">
          <h2 id="team-meeting-title">💛 Teamtreffen · Freitag, 30.10., 15 Uhr</h2>
          <p>Ihr Lieben, hier ist es herbstlich sonnig, und mit jedem Handgriff wächst die Vorfreude – und ein bisschen aufgeregt sind wir auch! Zehn Jahre Bendito: Wie schön, diese Jubiläumsedition mit euch zu gestalten. Danke, dass ihr eure Zeit, Energie und euer Herz mitbringt.</p>
          <p>Bitte kommt am Freitag um <strong>15 Uhr zum Teamtreffen</strong>, wenn es euch möglich ist. Wir möchten uns kennenlernen, gemeinsam starten und die letzten Fragen klären. <strong>Wenn du nicht dabei sein kannst, gib uns bitte kurz Bescheid.</strong></p>
          <p>Lies bitte in jedem Fall die Infos unter <strong>„Anleitungen“</strong> gut durch – dort stehen die Grundlagen für deine Mithilfe. Wir freuen uns auf euch! Un abrazo, Norbert und das Bendito-Team</p>
          <button type="button" class="team-meeting-link" onClick=${function () { setView('howto'); }}>Anleitungen lesen →</button>
        </section>` : null}
        ${reminder ? html`<div class="notice warn" data-reminder="1"><span>${reminder}</span>
          ${cur === 'settings' ? null : html`<button type="button" onClick=${function () { setView('settings'); }}>Zu den Einstellungen</button>`}</div>` : null}
        <nav class="nav" aria-label="Tage">
          ${DAYS.map(function (x) {
            var ds = d.dayStats[x.id];
            var on = day === x.id && cur === 'board';
            return html`<button key=${x.id} type="button" class=${on ? 'nav-d on' : 'nav-d'} aria-current=${on ? 'true' : 'false'}
              onClick=${function () { setDay(x.id); if (cur !== 'board') setView('board'); }}>
              <span class="dn">${x.sh}</span> ${x.lb}<span class="dp">${ds.pct}% besetzt</span>
            </button>`;
          })}
        </nav>
        <nav class="tabs" aria-label="Ansichten">
          ${tabs.map(function (t) {
            return html`<button key=${t[0]} type="button" data-view=${t[0]} class=${cur === t[0] ? 'tab on' : 'tab'} aria-current=${cur === t[0] ? 'page' : 'false'}
              onClick=${function () { setView(t[0]); }}>${t[1]}${t[2] > 0 ? html`<span class="badge">${t[2]}</span>` : null}</button>`;
          })}
        </nav>
        <main key=${cur}>${body}</main>
        ${dialogEl}
        <footer class="footer">Bendito Helferplan · Version ${VERSION} · <button type="button" class="footer-link" onClick=${function () { setDlg({type: 'privacy'}); }}>Datenschutz</button></footer>
        ${dialogEl ? null : toastStack}
      </div>`;
  }

  var rootEl = document.getElementById('root');
  rootEl.textContent = '';   // Ladehinweis aus index.html entfernen
  // Nicht in fremden Seiten eingebettet laufen (Schutz gegen untergeschobene Klicks).
  var framed = false;
  try { framed = window.top !== window.self; } catch (e) { framed = true; }
  if (framed) {
    var p = document.createElement('p');
    p.className = 'boot';
    p.textContent = 'Der Helferplan lässt sich nicht eingebettet öffnen. Bitte die Adresse direkt aufrufen.';
    rootEl.appendChild(p);
    return;
  }
  // Neue Fassung: config.js ohne Cache vergleichen. Gleicher Stand bleibt.
  // Eine andere Fassung lädt direkt neu, außer jemand tippt gerade.
  function freshUrl() {
    var url = new URL(location.href);
    url.searchParams.set('_', String(Date.now()));
    return url.href;
  }
  function formBusy() {
    var active = document.activeElement;
    if (active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) return true;
    var fields = document.querySelectorAll('form input, form textarea, form select');
    for (var i = 0; i < fields.length; i++) {
      var field = fields[i];
      if (field.type === 'radio' || field.type === 'checkbox') { if (field.checked !== field.defaultChecked) return true; }
      else if (field.value !== field.defaultValue) return true;
    }
    return false;
  }
  function showUpdateBar() {
    if (document.querySelector('.update-bar')) return;
    var bar = document.createElement('div');
    bar.className = 'update-bar';
    bar.setAttribute('role', 'status');
    var text = document.createElement('span');
    text.textContent = 'Neue Fassung da.';
    var button = document.createElement('button');
    button.type = 'button';
    button.textContent = 'Neu laden';
    button.addEventListener('click', function () { location.replace(freshUrl()); });
    bar.appendChild(text);
    bar.appendChild(button);
    document.body.appendChild(bar);
  }
  function checkUpdate() {
    fetch('config.js?_=' + Date.now(), {cache: 'no-store'}).then(function (res) {
      return res.ok ? res.text() : '';
    }).then(function (text) {
      var match = /version:\s*'([^']+)'/.exec(text || '');
      if (!match) return;
      if (match[1] === CFG.version) {
        var clean = new URL(location.href);
        if (clean.searchParams.has('_')) {
          clean.searchParams.delete('_');
          history.replaceState(null, '', clean.pathname + clean.search + clean.hash);
        }
        return;
      }
      var seen = '';
      try { seen = sessionStorage.getItem('hp-seen-version') || ''; } catch (e) {}
      if (seen === match[1] || formBusy()) showUpdateBar();
      else {
        try { sessionStorage.setItem('hp-seen-version', match[1]); } catch (e) {}
        location.replace(freshUrl());
      }
    }, function () {});
  }
  checkUpdate();
  setInterval(checkUpdate, 120000);
  window.addEventListener('focus', checkUpdate);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') checkUpdate();
  });

  Pr(Ph(App), rootEl);
})();
