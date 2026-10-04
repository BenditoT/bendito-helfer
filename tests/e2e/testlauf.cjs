// Testlauf mit drei getrennten Browserprofilen: Orga, Test Anna, Test Ben.
//
// Spielt die acht Schritte aus dem Sprint (7.1) durch und prüft dabei die
// Akzeptanzpunkte der Phasen 2 bis 5: gemeinsamer Stand, Aktualisierung ohne
// Neuladen, Offline-Hinweis, Rechte, Tausch mit Maus und nur mit Tastatur,
// 390 px Breite, Tippziele.
//
// Braucht Playwright (global oder über NODE_PATH) und ein laufendes Ziel:
//   lokal:  tests/local/db-reset.sh hp_e2e, Orga-Konto und Testhelfer anlegen,
//           HP_PGDATABASE=hp_e2e node tests/local/stub-server.mjs
//   live:   HP_BASE_URL=https://benditot.github.io/bendito-helfer/ \
//           HP_ADMIN_EMAIL=… HP_ADMIN_PASSWORD=… node tests/e2e/testlauf.cjs
// Voraussetzung in beiden Fällen: die Testhelfer „Test Anna“, „Test Ben“ und
// „Test Cleo“ existieren (supabase/tests/seed_test_helpers.sql) und haben keine
// Schichten. Der Lauf endet mit „Testdaten entfernen“.
//
// Der Lauf schaltet die Tauschsperre um und ändert kurz den Sperrzeitpunkt. Er
// bricht deshalb sofort ab, wenn im Ziel ein Helfer existiert, der kein
// Testhelfer ist: Mit echten Helfern läuft er nicht.
const path = require('node:path');
const fs = require('node:fs');
let chromium;
try { ({ chromium } = require('playwright')); }
catch (e) { ({ chromium } = require('/opt/npm-tools/node_modules/playwright')); }

const BASE = process.env.HP_BASE_URL || 'http://127.0.0.1:4173/';
const LOCAL = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(BASE);
const ADMIN_EMAIL = process.env.HP_ADMIN_EMAIL || 'orga@test.invalid';
const ORGA_PW = process.env.HP_ADMIN_PASSWORD || 'lokal-orga-passwort';
const OUT = process.env.HP_SHOTS || path.join(__dirname, '../../test-results/testlauf');
const LIMIT = 30000; // „binnen 30 Sekunden“ ist die Anforderung, kein Puffer

fs.mkdirSync(OUT, { recursive: true });
const results = [];
const profiles = {};
let shotNo = 0;

function expect(cond, msg) { if (!cond) throw new Error(msg); }
async function until(fn, ms, what) {
  const start = Date.now();
  for (;;) {
    const v = await fn();
    if (v) return Date.now() - start;
    if (Date.now() - start > ms) throw new Error('nicht binnen ' + ms / 1000 + ' s: ' + what);
    await new Promise((r) => setTimeout(r, 250));
  }
}
async function shot(page, name) {
  shotNo += 1;
  const file = String(shotNo).padStart(2, '0') + '-' + name + '.png';
  await page.screenshot({ path: path.join(OUT, file) });
  return file;
}
async function step(name, fn) {
  const started = Date.now();
  try {
    const note = await fn();
    results.push({ step: name, ok: true, ms: Date.now() - started, note: note || '' });
    console.log('OK   ' + name + (note ? '  (' + note + ')' : ''));
  } catch (e) {
    results.push({ step: name, ok: false, ms: Date.now() - started, err: e.message.split('\n')[0] });
    console.log('ROT  ' + name + '\n       ' + e.message.split('\n')[0]);
    for (const [who, p] of Object.entries(profiles)) {
      try { await p.page.screenshot({ path: path.join(OUT, 'FEHLER-' + results.length + '-' + who + '.png') }); } catch (_e) { /* Seite zu */ }
    }
  }
}

async function newProfile(browser, name, viewport, touch) {
  const ctx = await browser.newContext({ viewport, hasTouch: !!touch, locale: 'de-DE', acceptDownloads: true });
  const page = await ctx.newPage();
  const p = { name, ctx, page, origins: new Set(), scriptErrors: [], netNoise: [] };
  page.on('request', (r) => { try { p.origins.add(new URL(r.url()).origin); } catch (_e) { /* data: */ } });
  page.on('pageerror', (e) => p.scriptErrors.push('pageerror: ' + e.message));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const t = m.text();
    // Der Browser meldet fehlgeschlagene Abrufe selbst als Konsolenfehler. Das ist
    // bei den absichtlich ausgelösten Fällen (falscher Link, Offline) erwartbar
    // und wird getrennt gezählt.
    if (/Failed to load resource|net::ERR_/.test(t)) p.netNoise.push(t); else p.scriptErrors.push('console: ' + t);
  });
  profiles[name] = p;
  return p;
}

const card = (page, id) => page.locator('.card[data-shift="' + id + '"]');
const statusOk = (page) => page.locator('.status[data-conn="ok"]');
async function openView(page, view) {
  await page.locator('[data-view="' + view + '"]').click();
}
async function tabTo(page, selector, max) {
  for (let i = 0; i < (max || 250); i++) {
    await page.keyboard.press('Tab');
    const hit = await page.evaluate((sel) => !!document.activeElement && document.activeElement.matches(sel), selector);
    if (hit) return i + 1;
  }
  throw new Error('per Tab nicht erreichbar: ' + selector);
}
async function adminLogin(page) {
  await page.goto(BASE);
  await page.getByRole('button', { name: 'Orga-Login' }).click();
  await page.getByLabel('E-Mail').fill(ADMIN_EMAIL);
  await page.getByLabel('Passwort').fill(ORGA_PW);
  await page.getByRole('button', { name: 'Anmelden', exact: true }).click();
  await statusOk(page).waitFor({ timeout: 15000 });
}
async function assign(page, helperName, shiftId) {
  await openView(page, 'board');
  const day = { f: 'Fr', s: 'Sa', u: 'So' }[shiftId[0]];
  await page.locator('.nav-d', { hasText: day }).first().click();
  await page.locator('.chip', { hasText: helperName }).click();
  await card(page, shiftId).locator('.slot').first().click();
}
async function makeLink(page, helperName) {
  await openView(page, 'settings');
  const row = page.locator('.mini-h[data-helper="' + helperName + '"]');
  await row.getByRole('button', { name: /Login-Link (erzeugen|erneuern)/ }).click();
  const confirm = page.getByRole('button', { name: 'Neuen Link erzeugen' });
  const box = page.getByLabel('Persönlicher Login-Link');
  await Promise.race([confirm.waitFor({ timeout: 8000 }), box.waitFor({ timeout: 8000 })]);
  if (await confirm.isVisible()) await confirm.click();
  await box.waitFor({ timeout: 8000 });
  const url = await box.inputValue();
  await page.getByRole('button', { name: 'Fertig' }).click();
  return url;
}
// Liegt das Element vollständig im sichtbaren Bereich des Fensters?
const inViewport = (page, selector) => page.evaluate((sel) => {
  const el = document.querySelector(sel);
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0 && r.top >= 0 && r.left >= 0 && r.bottom <= window.innerHeight && r.right <= window.innerWidth;
}, selector);
const planShifts = (page) => page.locator('.plan-shift').evaluateAll((els) => els.map((e) => e.getAttribute('data-shift')).sort());
const sessionToken = (page) => page.evaluate(() => { try { return JSON.parse(localStorage.getItem('hp-auth')).access_token; } catch (e) { return null; } });

(async () => {
  const browser = await chromium.launch();
  const orga = await newProfile(browser, 'orga', { width: 1280, height: 900 });
  const anna = await newProfile(browser, 'anna', { width: 390, height: 844 }, true);
  const ben = await newProfile(browser, 'ben', { width: 1024, height: 768 });
  let annaLink = '', benLink = '', annaLinkOld = '';
  let onlyTestHelpers = false;

  await step('0 Orga meldet sich an; Version 5.0.0 im Fuß', async () => {
    await adminLogin(orga.page);
    const foot = await orga.page.locator('.footer').innerText();
    expect(/Version 5\.0\.0/.test(foot), 'Fuß zeigt: ' + foot);
    const names = await orga.page.locator('.chip').allInnerTexts();
    expect(names.some((n) => n.includes('Test Anna')) && names.some((n) => n.includes('Test Ben')), 'Testhelfer fehlen: ' + names.join(' | '));
    expect((await orga.page.locator('.stat-pill').innerText()).startsWith('0/'), 'Plan ist nicht leer');
    await shot(orga.page, 'orga-board-leer');
    // Schutz: nur Testhelfer im Ziel, sonst wird nichts angefasst.
    await openView(orga.page, 'settings');
    const rows = await orga.page.locator('.mini-h').count();
    const tests = await orga.page.locator('.mini-h:has(.tag.test)').count();
    onlyTestHelpers = rows > 0 && rows === tests;
    expect(onlyTestHelpers, 'Im Ziel gibt es ' + (rows - tests) + ' Helfer, die keine Testhelfer sind. Der Testlauf läuft nicht mit echten Helfern.');
    await openView(orga.page, 'board');
    return rows + ' Helfer, alle Testhelfer';
  });
  if (!onlyTestHelpers) {
    await browser.close();
    fs.writeFileSync(path.join(OUT, 'ergebnis.json'), JSON.stringify({ base: BASE, at: new Date().toISOString(), results }, null, 2));
    console.log('\nAbbruch vor der ersten Änderung: Anmeldung fehlgeschlagen oder echte Helfer im Ziel.');
    process.exit(1);
  }

  await step('1 Orga weist Anna und Ben je zwei Schichten zu', async () => {
    await assign(orga.page, 'Test Anna', 'f06a');
    await card(orga.page, 'f06a').locator('.person', { hasText: 'Test Anna' }).waitFor({ timeout: 8000 });
    await assign(orga.page, 'Test Ben', 'f08a');
    await card(orga.page, 'f08a').locator('.person', { hasText: 'Test Ben' }).waitFor({ timeout: 8000 });
    await assign(orga.page, 'Test Anna', 's02a');
    await card(orga.page, 's02a').locator('.person', { hasText: 'Test Anna' }).waitFor({ timeout: 8000 });
    await assign(orga.page, 'Test Ben', 's03a');
    await card(orga.page, 's03a').locator('.person', { hasText: 'Test Ben' }).waitFor({ timeout: 8000 });
    await shot(orga.page, 'orga-board-zugewiesen');
  });

  await step('1b Überschneidung wird abgefragt, nicht still zugewiesen', async () => {
    await assign(orga.page, 'Test Anna', 'f07'); // Fr 18:00 Konzert überschneidet Fr 17:30 Bar
    const dlg = orga.page.getByRole('dialog');
    await dlg.waitFor({ timeout: 8000 });
    expect(/überschneiden/i.test(await dlg.innerText()), 'Dialog fehlt');
    await shot(orga.page, 'orga-ueberschneidung');
    await dlg.getByRole('button', { name: 'Abbrechen' }).click();
    expect(await card(orga.page, 'f07').locator('.person').count() === 0, 'trotzdem zugewiesen');
    await orga.page.keyboard.press('Escape');
  });

  await step('1c Orga entfernt eine Zuweisung: Rückmeldung mit Erinnerung, Bescheid zu sagen', async () => {
    await assign(orga.page, 'Test Cleo', 'f07');
    await card(orga.page, 'f07').locator('.person', { hasText: 'Test Cleo' }).waitFor({ timeout: 8000 });
    await orga.page.keyboard.press('Escape');
    await card(orga.page, 'f07').locator('.person .rm').click();
    const toast = orga.page.locator('[data-toast="notice"]');
    await toast.waitFor({ timeout: 8000 });
    const text = await toast.innerText();
    expect(/Test Cleo ist aus Fr 18:00 .* entfernt/.test(text) && /Bescheid/.test(text), 'Rückmeldung: ' + text);
    // Die Meldung erscheint, sobald der Server geantwortet hat; die Karte folgt mit dem Neuladen.
    await until(async () => (await card(orga.page, 'f07').locator('.person').count()) === 0, 8000, 'Zuweisung verschwindet von der Karte');
    await toast.getByRole('button', { name: 'Schließen' }).click();
    expect(await toast.count() === 0, 'Meldung lässt sich nicht schließen');
  });

  await step('1d Haken „Testhelfer“ springt nach dem Anlegen zurück', async () => {
    await openView(orga.page, 'settings');
    await orga.page.locator('#ad-name').fill('Test Dora');
    await orga.page.locator('#ad-test').check();
    await orga.page.locator('.s-block', { hasText: 'Helfer anlegen' }).getByRole('button', { name: 'Anlegen', exact: true }).click();
    await orga.page.locator('.mini-h[data-helper="Test Dora"] .tag.test').waitFor({ timeout: 8000 });
    expect(!(await orga.page.locator('#ad-test').isChecked()), 'Haken „Testhelfer“ ist noch gesetzt');
    expect(await orga.page.locator('#ad-name').inputValue() === '', 'Namensfeld nicht geleert');
    await orga.page.locator('#bulk-names').fill('Test Emil');
    await orga.page.locator('#bulk-test').check();
    await orga.page.getByRole('button', { name: 'Alle anlegen' }).click();
    await orga.page.locator('.mini-h[data-helper="Test Emil"] .tag.test').waitFor({ timeout: 8000 });
    expect(!(await orga.page.locator('#bulk-test').isChecked()), 'Haken „als Testhelfer“ ist noch gesetzt');
  });

  await step('1e Fehler im Dialog: Meldung steht unter dem Dialog und verdeckt nichts, Fokus bleibt im Dialog', async () => {
    await orga.page.setViewportSize({ width: 390, height: 664 });
    await openView(orga.page, 'settings');
    await orga.page.locator('.mini-h[data-helper="Test Emil"]').getByRole('button', { name: 'Bearbeiten' }).click();
    const dlg = orga.page.getByRole('dialog');
    await dlg.waitFor();
    await dlg.locator('#hf-name').fill('Test Dora');
    await dlg.getByRole('button', { name: 'Speichern' }).click();
    // Auf genau diese Meldung warten: Die Erfolgsmeldung aus dem Schritt davor kann noch stehen.
    await orga.page.locator('.overlay [data-toast="notice"]', { hasText: 'Diesen Namen gibt es schon' }).waitFor({ timeout: 8000 });
    const geo = await orga.page.evaluate(() => {
      const t = document.querySelector('.overlay [data-toast="notice"]').getBoundingClientRect();
      const p = document.querySelector('.overlay .popup').getBoundingClientRect();
      const b = Array.from(document.querySelectorAll('.overlay .popup .dlg-actions button')).map((x) => x.getBoundingClientRect());
      return { gap: Math.round(t.top - p.bottom), toastInView: t.bottom <= window.innerHeight, popupInView: p.top >= 0,
        buttonsFree: b.every((r) => r.bottom <= t.top), focusInDialog: !!document.activeElement.closest('[role="dialog"]') };
    });
    expect(geo.gap >= 0 && geo.buttonsFree, 'Meldung verdeckt den Dialog: ' + JSON.stringify(geo));
    expect(geo.toastInView && geo.popupInView, 'Dialog oder Meldung ragt aus dem Bildschirm: ' + JSON.stringify(geo));
    expect(geo.focusInDialog, 'Fokus ist aus dem Dialog gefallen');
    await shot(orga.page, 'orga-fehler-im-dialog');
    await dlg.getByRole('button', { name: 'Abbrechen' }).click();
    await orga.page.setViewportSize({ width: 1280, height: 900 });
    const stay = orga.page.locator('[data-toast="notice"]');
    if (await stay.count()) await stay.getByRole('button', { name: 'Schließen' }).click();
  });

  await step('1f Ein überholter Abruf überschreibt den Stand nach einer eigenen Änderung nicht', async () => {
    await openView(orga.page, 'board');
    let held = null, taken = false;
    await orga.ctx.route('**/rest/v1/rpc/hp_state', async (route) => {
      if (!taken) { taken = true; const resp = await route.fetch(); held = { route, resp }; return; }
      await route.continue();
    });
    // Abruf A startet und bleibt mit dem alten Stand unterwegs hängen.
    await until(async () => { await orga.page.evaluate(() => window.dispatchEvent(new Event('focus'))); return !!held; }, LIMIT, 'Abruf A abgefangen');
    // Eigene Änderung: Danach muss ein neuer Abruf B den Stand liefern, nicht A.
    await assign(orga.page, 'Test Cleo', 'f07');
    await card(orga.page, 'f07').locator('.person', { hasText: 'Test Cleo' }).waitFor({ timeout: 8000 });
    await held.route.fulfill({ response: held.resp });
    // Kein Warten auf etwas, das kommen soll: Hier darf sich nichts mehr ändern.
    await orga.page.waitForTimeout(700);
    expect(await card(orga.page, 'f07').locator('.person').count() === 1, 'der überholte Abruf hat die Zuweisung wieder ausgeblendet');
    expect(await statusOk(orga.page).count() === 1, 'Statuszeile ist nicht grün');
    await orga.ctx.unroute('**/rest/v1/rpc/hp_state');
    await orga.page.keyboard.press('Escape');
    await card(orga.page, 'f07').locator('.person .rm').click();
    await until(async () => (await card(orga.page, 'f07').locator('.person').count()) === 0, 8000, 'Aufräumen: Zuweisung entfernt');
    await orga.page.locator('[data-toast="notice"]').getByRole('button', { name: 'Schließen' }).click();
  });

  await step('2 Anna und Ben öffnen ihre Links und sehen ihre Schichten', async () => {
    annaLink = await makeLink(orga.page, 'Test Anna');
    benLink = await makeLink(orga.page, 'Test Ben');
    expect(/#k=[0-9a-f]{64}$/.test(annaLink) && /#k=[0-9a-f]{64}$/.test(benLink), 'Linkformat');
    await anna.page.goto(annaLink);
    await statusOk(anna.page).waitFor({ timeout: LIMIT });
    await ben.page.goto(benLink);
    await statusOk(ben.page).waitFor({ timeout: LIMIT });
    expect(!anna.page.url().includes('#k='), 'Code steht noch in der Adresszeile');
    await openView(anna.page, 'myplan');
    await openView(ben.page, 'myplan');
    expect(JSON.stringify(await planShifts(anna.page)) === JSON.stringify(['f06a', 's02a']), 'Annas Plan: ' + await planShifts(anna.page));
    expect(JSON.stringify(await planShifts(ben.page)) === JSON.stringify(['f08a', 's03a']), 'Bens Plan: ' + await planShifts(ben.page));
    expect(await anna.page.locator('.login-box').count() === 0, 'Login-Maske noch sichtbar');
    await shot(anna.page, 'anna-mein-plan');
  });

  await step('2b Neue Zuweisung erscheint bei Anna ohne Neuladen', async () => {
    await assign(orga.page, 'Test Anna', 'u03a');
    await card(orga.page, 'u03a').locator('.person', { hasText: 'Test Anna' }).waitFor({ timeout: 8000 });
    const ms = await until(async () => (await planShifts(anna.page)).includes('u03a'), LIMIT, 'Zuweisung bei Anna sichtbar');
    return 'nach ' + (ms / 1000).toFixed(1) + ' s';
  });

  await step('2c Nach Neuladen bleibt Anna angemeldet', async () => {
    await anna.page.reload();
    await statusOk(anna.page).waitFor({ timeout: LIMIT });
    expect((await anna.page.locator('.who').innerText()).includes('Test Anna'), 'nicht mehr angemeldet');
  });

  await step('2d Helfer ruft Orga-Funktion direkt auf: Server lehnt ab', async () => {
    const out = await anna.page.evaluate(async () => {
      const tok = JSON.parse(localStorage.getItem('hp-auth')).access_token;
      const cfg = window.HP_CONFIG;
      const call = (fn, body) => fetch(cfg.supabaseUrl + '/rest/v1/rpc/' + fn, {
        method: 'POST', headers: { 'Content-Type': 'application/json', apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + tok }, body: JSON.stringify(body),
      }).then((r) => r.status);
      return [await call('hp_admin_purge', { p_confirm: 'LOESCHEN' }), await call('hp_admin_remove_test_data', {}), await call('hp_admin_set_setting', { p_key: 'swaps_locked', p_value: true })];
    });
    expect(out.every((s) => s === 403 || s === 401), 'Status: ' + out.join(','));
    anna.netNoise.length = 0; // die drei Ablehnungen waren Absicht
    await orga.page.locator('.status-btn, .status').first().waitFor();
    expect((await orga.page.locator('.stat-pill').innerText()).startsWith('5/'), 'Plan wurde verändert');
    return 'HTTP ' + out.join(', ');
  });

  await step('3 Anna fragt Tausch mit Bens Schicht an; Ben nimmt an', async () => {
    // Auf dem Telefon vom Board aus: Die Karte liegt weiter unten, die Seite ist gescrollt.
    await openView(anna.page, 'board');
    await anna.page.locator('.nav-d', { hasText: 'Fr' }).first().click();
    await card(anna.page, 'f06a').evaluate((el) => el.scrollIntoView({ block: 'start' }));
    const scrolled = await anna.page.evaluate(() => Math.round(window.scrollY));
    expect(scrolled > 100, 'Seite ist nicht gescrollt (' + scrolled + ' px), die Prüfung wäre wertlos');
    await card(anna.page, 'f06a').locator('.swap-btn').click();
    const dlg = anna.page.getByRole('dialog');
    await dlg.waitFor();
    // Sa 10:00 Brunch überschneidet Annas Sa 10:00 Bar und darf nicht wählbar sein.
    expect(await dlg.locator('option[value="s01"]').isDisabled(), 'überschneidende Schicht ist wählbar');
    expect(!(await dlg.locator('option[value="f08a"]').isDisabled()), 'Bens Schicht ist nicht wählbar');
    expect(/00:30 \(Nacht auf Sa\)/.test(await dlg.locator('option[value="f13a"]').innerText()), 'Nachtschicht ohne Vermerk in der Auswahl');
    await dlg.locator('select').selectOption('f08a');
    await dlg.locator('textarea').fill('Testlauf');
    await shot(anna.page, 'anna-tausch-anfragen');
    await dlg.getByRole('button', { name: 'Anfrage senden' }).click();
    const sentAt = Date.now();
    const toast = anna.page.locator('[data-toast="notice"]');
    await toast.waitFor({ timeout: 8000 });
    const said = await toast.innerText();
    expect(/Sag Test Ben kurz Bescheid/.test(said), 'Meldung nennt nicht, wem Bescheid zu sagen ist: ' + said);
    // Die Meldung ist zu sehen, obwohl die Seite gescrollt ist.
    expect(await anna.page.evaluate(() => window.scrollY) > 100, 'Seite ist zurückgesprungen');
    expect(await inViewport(anna.page, '[data-toast="notice"]'), 'Meldung liegt außerhalb des sichtbaren Bereichs');
    await shot(anna.page, 'anna-meldung-trotz-scrollen');
    // Die eigene offene Anfrage ist an der Schicht markiert, auf dem Board und im Plan.
    await card(anna.page, 'f06a').locator('.card-swap-out').waitFor({ timeout: 8000 });
    expect(/Fr 19:00/.test(await card(anna.page, 'f06a').locator('.card-swap-out').innerText()), 'Markierung auf der Karte nennt das Ziel nicht');
    await openView(anna.page, 'myplan');
    expect(/Tausch angefragt/.test(await anna.page.locator('.plan-shift[data-shift="f06a"]').innerText()), 'Markierung im Plan fehlt');
    // Die Orga will Anna aus genau dieser Schicht nehmen: Die App fragt vorher nach.
    await openView(orga.page, 'board');
    await orga.page.locator('.nav-d', { hasText: 'Fr' }).first().click();
    await until(async () => (await card(orga.page, 'f08a').locator('.card-swap-in').count()) > 0, LIMIT, 'Anfrage bei der Orga sichtbar');
    await card(orga.page, 'f06a').locator('.person .rm').click();
    const ask = orga.page.getByRole('dialog');
    await ask.waitFor({ timeout: 8000 });
    expect(/offene Tauschanfrage/i.test(await ask.innerText()), 'Rückfrage fehlt: ' + await ask.innerText());
    await ask.getByRole('button', { name: 'Abbrechen' }).click();
    expect(await card(orga.page, 'f06a').locator('.person', { hasText: 'Test Anna' }).count() === 1, 'trotz Abbrechen entfernt');
    // Die Frist zählt ab dem Absenden, nicht ab hier.
    await until(async () => (await ben.page.locator('[data-view="myswaps"] .badge').count()) > 0, Math.max(1000, LIMIT - (Date.now() - sentAt)), 'Anfrage bei Ben sichtbar');
    const ms = Date.now() - sentAt;
    await openView(ben.page, 'myswaps');
    await shot(ben.page, 'ben-anfrage');
    await ben.page.locator('.sw-yes').click();
    await ben.page.getByRole('dialog').getByRole('button', { name: 'Tauschen' }).click();
    await ben.page.locator('.notice.info').waitFor({ timeout: 8000 });
    return 'Anfrage bei Ben sichtbar, geprüft ' + (ms / 1000).toFixed(1) + ' s nach dem Absenden';
  });

  await step('4 Beide Pläne und das Board zeigen den Tausch, auch nach Neuladen', async () => {
    const check = async () => {
      await openView(ben.page, 'myplan');
      await openView(anna.page, 'myplan');
      await until(async () => JSON.stringify(await planShifts(anna.page)) === JSON.stringify(['f08a', 's02a', 'u03a']), LIMIT, 'Annas Plan getauscht');
      expect(JSON.stringify(await planShifts(ben.page)) === JSON.stringify(['f06a', 's03a']), 'Bens Plan: ' + await planShifts(ben.page));
      await openView(orga.page, 'board');
      await orga.page.locator('.nav-d', { hasText: 'Fr' }).first().click();
      await until(async () => (await card(orga.page, 'f06a').innerText()).includes('Test Ben'), LIMIT, 'Board der Orga getauscht');
      expect((await card(orga.page, 'f08a').innerText()).includes('Test Anna'), 'f08a ohne Anna');
      expect(await card(orga.page, 'f06a').locator('.person').count() === 1 && await card(orga.page, 'f08a').locator('.person').count() === 1, 'Schicht nicht genau einfach besetzt');
    };
    await check();
    for (const p of [anna, ben, orga]) { await p.page.reload(); await statusOk(p.page).waitFor({ timeout: LIMIT }); }
    await check();
    await openView(anna.page, 'inbox');
    await anna.page.locator('.msg-card').first().waitFor({ timeout: 8000 });
    expect(/Tausch durchgeführt/.test(await anna.page.locator('.msg-card').first().innerText()), 'Hinweis bei Anna fehlt');
    await shot(anna.page, 'anna-hinweis');
    await shot(orga.page, 'orga-board-getauscht');
  });

  await step('5 Falscher Link: verständliche Meldung, kein Zugang', async () => {
    const ctx = await browser.newContext({ locale: 'de-DE' });
    const page = await ctx.newPage();
    await page.goto(BASE + '#k=' + 'ab'.repeat(32));
    await page.locator('.login-box .err').waitFor({ timeout: 15000 });
    const text = await page.locator('.login-box .err').innerText();
    expect(/nicht gültig/.test(text), 'Meldung: ' + text);
    expect(await page.locator('.status').count() === 0, 'Zugang trotz falschem Link');
    expect(!page.url().includes('#k='), 'Code steht noch in der Adresszeile');
    await shot(page, 'falscher-link');
    await ctx.close();
  });

  await step('6 Orga erneuert Annas Link: alter Link tot, offene Sitzung endet, neuer Link geht', async () => {
    annaLinkOld = annaLink;
    annaLink = await makeLink(orga.page, 'Test Anna');
    expect(annaLink !== annaLinkOld, 'Link unverändert');
    const ms = await until(async () => (await anna.page.locator('.login-box').count()) > 0, LIMIT, 'Annas offene Sitzung endet');
    expect(/nicht mehr gültig/.test(await anna.page.locator('.login-box').innerText()), 'Hinweis fehlt');
    const ctx = await browser.newContext({ locale: 'de-DE' });
    const page = await ctx.newPage();
    await page.goto(annaLinkOld);
    await page.locator('.login-box .err').waitFor({ timeout: 15000 });
    expect(await page.locator('.status').count() === 0, 'alter Link öffnet noch');
    await ctx.close();
    await anna.page.goto(annaLink);
    await statusOk(anna.page).waitFor({ timeout: LIMIT });
    expect((await anna.page.locator('.who').innerText()).includes('Test Anna'), 'neuer Link meldet nicht an');
    anna.netNoise.length = 0; // die Ablehnung der alten Sitzung war Absicht
    return 'offene Sitzung endete nach ' + (ms / 1000).toFixed(1) + ' s';
  });

  await step('6b Ohne Netz: roter Hinweis, Aktionen gesperrt; mit Netz wieder grün', async () => {
    await openView(ben.page, 'myplan');
    await ben.ctx.setOffline(true);
    const ms = await until(async () => (await ben.page.locator('.status[data-conn="offline"]').count()) > 0, LIMIT, 'roter Hinweis');
    const text = await ben.page.locator('.status').innerText();
    expect(/Keine Verbindung – letzter Stand \d\d:\d\d:\d\d, Änderungen gesperrt/.test(text), 'Statuszeile: ' + text);
    expect(await ben.page.locator('.plan-shift .swap-btn').first().isDisabled(), 'Tausch-Knopf ist nicht gesperrt');
    expect((await planShifts(ben.page)).length === 2, 'letzter Stand nicht mehr sichtbar');
    expect(await inViewport(ben.page, '[data-toast="conn"]'), 'Hinweis „keine Verbindung“ unten fehlt');
    await shot(ben.page, 'ben-offline');
    await ben.ctx.setOffline(false);
    const back = await until(async () => (await statusOk(ben.page).count()) > 0, LIMIT, 'wieder grün');
    expect(!(await ben.page.locator('.plan-shift .swap-btn').first().isDisabled()), 'Knopf bleibt gesperrt');
    expect(await ben.page.locator('[data-toast="conn"]').count() === 0, 'Hinweis unten bleibt stehen');
    ben.netNoise.length = 0; // Offline war Absicht
    return 'rot nach ' + (ms / 1000).toFixed(1) + ' s, grün nach ' + (back / 1000).toFixed(1) + ' s';
  });

  await step('6b2 Server antwortet nicht (Browser meldet kein „offline“): trotzdem rot binnen 30 s', async () => {
    // Abruf hängt, ohne dass der Browser die Verbindung als getrennt meldet.
    await ben.ctx.route('**/rest/v1/rpc/hp_state', () => { /* nie beantworten */ });
    const ms = await until(async () => (await ben.page.locator('.status[data-conn="offline"]').count()) > 0, LIMIT, 'roter Hinweis bei hängendem Server');
    expect(await ben.page.locator('.plan-shift .swap-btn').first().isDisabled(), 'Tausch-Knopf ist nicht gesperrt');
    await ben.ctx.unroute('**/rest/v1/rpc/hp_state');
    const back = await until(async () => (await statusOk(ben.page).count()) > 0, LIMIT, 'wieder grün');
    ben.netNoise.length = 0;
    return 'rot nach ' + (ms / 1000).toFixed(1) + ' s, grün nach ' + (back / 1000).toFixed(1) + ' s';
  });

  await step('6c Tausch nur mit der Tastatur: Ben fragt an, Anna nimmt an', async () => {
    await ben.page.locator('body').click({ position: { x: 5, y: 5 } });
    await tabTo(ben.page, '[data-view="myplan"]');
    await ben.page.keyboard.press('Enter');
    await tabTo(ben.page, '.plan-shift[data-shift="s03a"] .swap-btn');
    await ben.page.keyboard.press('Enter');
    await ben.page.getByRole('dialog').waitFor();
    expect(await ben.page.evaluate(() => !!document.activeElement.closest('[role="dialog"]')), 'Fokus nicht im Dialog');
    // Escape schließt und gibt den Fokus an den Auslöser zurück.
    await ben.page.keyboard.press('Escape');
    expect(await ben.page.getByRole('dialog').count() === 0, 'Escape schließt nicht');
    expect(await ben.page.evaluate(() => document.activeElement.matches('.plan-shift[data-shift="s03a"] .swap-btn')), 'Fokus nicht zurück beim Auslöser');
    await ben.page.keyboard.press('Enter');
    await ben.page.getByRole('dialog').waitFor();
    expect(await ben.page.evaluate(() => document.activeElement.id === 'swap-target'), 'Fokus nicht auf der Auswahl');
    for (let i = 0; i < 80; i++) {
      if (await ben.page.evaluate(() => document.activeElement.value) === 's02a') break;
      await ben.page.keyboard.press('ArrowDown');
    }
    expect(await ben.page.evaluate(() => document.activeElement.value) === 's02a', 'Zielschicht per Pfeiltaste nicht erreichbar');
    await tabTo(ben.page, '[role="dialog"] .btn-purple', 10);
    await ben.page.keyboard.press('Enter');
    await ben.page.locator('.notice.info').waitFor({ timeout: 8000 });
    // Anna nimmt an, ebenfalls ohne Maus.
    await until(async () => (await anna.page.locator('[data-view="myswaps"] .badge').count()) > 0, LIMIT, 'Anfrage bei Anna sichtbar');
    await anna.page.locator('body').click({ position: { x: 5, y: 5 } });
    await tabTo(anna.page, '[data-view="myswaps"]');
    await anna.page.keyboard.press('Enter');
    await tabTo(anna.page, '.sw-yes');
    await anna.page.keyboard.press('Enter');
    await anna.page.getByRole('dialog').waitFor();
    expect(await anna.page.evaluate(() => document.activeElement.textContent.trim() === 'Tauschen'), 'Fokus nicht auf „Tauschen“');
    await anna.page.keyboard.press('Enter');
    await anna.page.locator('.notice.info').waitFor({ timeout: 8000 });
    await openView(anna.page, 'myplan');
    await until(async () => JSON.stringify(await planShifts(anna.page)) === JSON.stringify(['f08a', 's03a', 'u03a']), LIMIT, 'Annas Plan nach Tastatur-Tausch');
    await openView(ben.page, 'myplan');
    await until(async () => JSON.stringify(await planShifts(ben.page)) === JSON.stringify(['f06a', 's02a']), LIMIT, 'Bens Plan nach Tastatur-Tausch');
  });

  await step('6e Zugriffstoken abgelaufen: App erneuert die Sitzung selbst, eine Änderung geht genau einmal durch', async () => {
    if (!LOCAL) return 'nur im lokalen Nachbau prüfbar, übersprungen';
    const before = {};
    for (const p of [orga, anna, ben]) before[p.name] = await sessionToken(p.page);
    const r = await fetch(new URL('__stub/expire-access-tokens', BASE), { method: 'POST' });
    expect(r.ok, 'Nachbau hat die Token nicht entwertet');
    // Orga ändert etwas mit dem entwerteten Token: abgewiesen, erneuert, wiederholt.
    await assign(orga.page, 'Test Cleo', 'f07');
    await card(orga.page, 'f07').locator('.person', { hasText: 'Test Cleo' }).waitFor({ timeout: 8000 });
    expect(await card(orga.page, 'f07').locator('.person').count() === 1, 'Zuweisung doppelt oder gar nicht ausgeführt');
    expect(await orga.page.locator('[data-toast="notice"].err').count() === 0, 'Fehlermeldung trotz Erneuerung');
    for (const p of [anna, ben]) await p.page.evaluate(() => window.dispatchEvent(new Event('focus')));
    for (const p of [orga, anna, ben]) {
      await until(async () => { const t = await sessionToken(p.page); return t && t !== before[p.name]; }, LIMIT, 'neue Sitzung bei ' + p.name);
      expect(await p.page.locator('.login-box').count() === 0, p.name + ' wurde abgemeldet');
      await statusOk(p.page).waitFor({ timeout: LIMIT });
    }
    await openView(ben.page, 'myplan');
    expect((await planShifts(ben.page)).length === 2, 'Bens Plan fehlt nach der Erneuerung');
    // Aufräumen.
    await orga.page.keyboard.press('Escape');
    await card(orga.page, 'f07').locator('.person .rm').click();
    await until(async () => (await card(orga.page, 'f07').locator('.person').count()) === 0, 8000, 'Aufräumen: Zuweisung entfernt');
    for (const p of [orga, anna, ben]) p.netNoise.length = 0; // die abgewiesenen Abrufe waren Absicht
  });

  await step('6f Datenschutz-Hinweis und Nachtschicht-Vermerk auf dem Telefon', async () => {
    await openView(anna.page, 'board');
    await anna.page.locator('.nav-d', { hasText: 'Fr' }).first().click();
    expect((await card(anna.page, 'f13a').locator('.card-night').innerText()) === 'Nacht auf Sa', 'Vermerk an der Nachtschicht fehlt');
    await anna.page.locator('.footer-link').click();
    const dlg = anna.page.getByRole('dialog');
    await dlg.waitFor();
    const text = await dlg.innerText();
    expect(/Was gespeichert wird/.test(text) && /Protokoll/.test(text) && /15\.11\.2026/.test(text), 'Datenschutz-Text unvollständig');
    await shot(anna.page, 'anna-datenschutz');
    await anna.page.keyboard.press('Escape');
    expect(await anna.page.getByRole('dialog').count() === 0, 'Dialog schließt nicht');
  });

  await step('6d Telefonbreite 390 px: kein waagerechtes Scrollen, Tippziele ab 44 px', async () => {
    const report = [];
    for (const view of ['board', 'myplan', 'myswaps', 'inbox', 'helpers', 'howto']) {
      await openView(anna.page, view);
      const m = await anna.page.evaluate(() => {
        const de = document.documentElement;
        const small = [];
        document.querySelectorAll('button, select, textarea, input:not([type="checkbox"]), a[href]').forEach((el) => {
          if (el.closest('.tabs') && el.getBoundingClientRect().right > de.clientWidth) return; // Tableiste scrollt für sich
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return;
          if (r.height < 43.5 || r.width < 43.5) small.push((el.className || el.tagName) + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
        });
        return { overflow: de.scrollWidth - de.clientWidth, small };
      });
      if (m.overflow > 0) report.push(view + ': ' + m.overflow + ' px zu breit');
      if (m.small.length) report.push(view + ': zu klein: ' + Array.from(new Set(m.small)).join(' | '));
    }
    await openView(anna.page, 'board');
    expect(await anna.page.locator('.tab.on').getAttribute('data-view') === 'board', 'Board-Reiter nicht aktiv');
    const tabsVisible = await anna.page.evaluate(() => Array.from(document.querySelectorAll('.tab')).every((t) => {
      const r = t.getBoundingClientRect(); return r.left >= 0 && r.right <= document.documentElement.clientWidth;
    }));
    expect(tabsVisible, 'nicht alle Reiter sind ohne Scrollen sichtbar');
    await anna.page.waitForTimeout(300); // Übergang der Reiter-Hervorhebung abwarten, nur für das Bild
    await shot(anna.page, 'anna-board-390');
    expect(report.length === 0, report.join(' ; '));
    expect(await anna.page.locator('img.logo-img').getAttribute('alt'), 'Logo ohne Alt-Text');
  });

  await step('7 Tausch sperren: Anfrage nicht mehr möglich', async () => {
    await openView(orga.page, 'settings');
    await orga.page.locator('#st-locked').check();
    await orga.page.locator('[data-toast="notice"]', { hasText: 'Tausch gesperrt.' }).waitFor({ timeout: 8000 });
    await openView(ben.page, 'myplan');
    const ms = await until(async () => (await ben.page.locator('.plan-shift .swap-btn').count()) === 0, LIMIT, 'Tausch-Knöpfe verschwinden bei Ben');
    expect(/Tausch ist gesperrt/.test(await ben.page.locator('.my-plan').innerText()), 'Hinweis fehlt');
    const direct = await ben.page.evaluate(async () => {
      const tok = JSON.parse(localStorage.getItem('hp-auth')).access_token;
      const cfg = window.HP_CONFIG;
      const r = await fetch(cfg.supabaseUrl + '/rest/v1/rpc/hp_swap_request', {
        method: 'POST', headers: { 'Content-Type': 'application/json', apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + tok },
        body: JSON.stringify({ p_from_shift: 'f06a', p_to_shift: 'f08a', p_note: '' }),
      });
      return r.json();
    });
    expect(direct && direct.code === 'SWAP_LOCKED', 'direkter Aufruf: ' + JSON.stringify(direct));
    await shot(ben.page, 'ben-tausch-gesperrt');
    await orga.page.locator('#st-locked').uncheck();
    await orga.page.locator('[data-toast="notice"]', { hasText: 'gelöst' }).waitFor({ timeout: 8000 });
    return 'bei Ben nach ' + (ms / 1000).toFixed(1) + ' s';
  });

  await step('7b Sperrzeitpunkt setzen und wieder leeren (leerer Wert kommt beim Server an)', async () => {
    await openView(orga.page, 'settings');
    const inp = orga.page.locator('#st-lockat');
    const save = orga.page.locator('.s-block', { hasText: 'Schichttausch' }).getByRole('button', { name: 'Speichern' });
    const toast = orga.page.locator('[data-toast="notice"]');
    const original = await inp.inputValue();
    await inp.fill('2031-01-01T10:00');
    await save.click();
    await until(async () => /Sperrzeitpunkt gespeichert/.test(await toast.innerText().catch(() => '')), 8000, 'Sperrzeitpunkt gespeichert');
    await inp.fill('');
    await save.click();
    await until(async () => /Sperrzeitpunkt entfernt/.test(await toast.innerText().catch(() => '')), 8000, 'Sperrzeitpunkt entfernt');
    expect(await orga.page.locator('[data-toast="notice"].err').count() === 0, 'Fehler beim Leeren');
    await orga.page.reload();
    await statusOk(orga.page).waitFor({ timeout: LIMIT });
    await openView(orga.page, 'settings');
    expect(await orga.page.locator('#st-lockat').inputValue() === '', 'Sperrzeitpunkt ist nach dem Leeren noch gesetzt');
    if (original) {
      await orga.page.locator('#st-lockat').fill(original);
      await orga.page.locator('.s-block', { hasText: 'Schichttausch' }).getByRole('button', { name: 'Speichern' }).click();
      await until(async () => /Sperrzeitpunkt gespeichert/.test(await orga.page.locator('[data-toast="notice"]').innerText().catch(() => '')), 8000, 'ursprünglicher Sperrzeitpunkt wieder gesetzt');
    }
    return original ? 'ursprünglicher Wert wieder gesetzt' : 'vorher leer, wieder leer';
  });

  await step('7c Nach dem Event erinnert die App die Orga an Sperren und Löschen', async () => {
    const call = (key, value) => orga.page.evaluate(async ([k, v]) => {
      const tok = JSON.parse(localStorage.getItem('hp-auth')).access_token;
      const cfg = window.HP_CONFIG;
      const r = await fetch(cfg.supabaseUrl + '/rest/v1/rpc/' + (k ? 'hp_admin_set_setting' : 'hp_state'), {
        method: 'POST', headers: { 'Content-Type': 'application/json', apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + tok },
        body: JSON.stringify(k ? { p_key: k, p_value: v } : {}),
      });
      return r.json();
    }, [key, value]);
    const poke = () => orga.page.evaluate(() => window.dispatchEvent(new Event('focus')));
    const banner = orga.page.locator('[data-reminder]');
    const original = (await call(null)).settings;
    expect(await banner.count() === 0, 'Erinnerung steht schon vor dem Event da');
    try {
      expect((await call('event_end', '2026-01-01T00:00:00Z')).ok, 'Eventende ließ sich nicht setzen');
      await until(async () => { await poke(); return (await banner.count()) > 0; }, LIMIT, 'Erinnerung nach dem Eventende');
      expect(/Das Event ist vorbei/.test(await banner.innerText()) && /Login-Links sperren/.test(await banner.innerText()), 'Text: ' + await banner.innerText());
      expect((await call('purge_after', '2026-01-02')).ok, 'Löschtermin ließ sich nicht setzen');
      await until(async () => { await poke(); return /Löschtermin \(02\.01\.2026\) ist erreicht/.test(await banner.innerText().catch(() => '')); }, LIMIT, 'Erinnerung am Löschtermin');
      await shot(orga.page, 'orga-erinnerung');
      await openView(orga.page, 'board');
      await banner.getByRole('button', { name: 'Zu den Einstellungen' }).click();
      expect(await orga.page.locator('.tab.on').getAttribute('data-view') === 'settings', 'Knopf führt nicht zu den Einstellungen');
    } finally {
      await call('event_end', original.event_end);
      await call('purge_after', original.purge_after);
    }
    await until(async () => { await poke(); return (await banner.count()) === 0; }, LIMIT, 'Erinnerung verschwindet nach dem Zurücksetzen');
    const now = (await call(null)).settings;
    expect(now.event_end === original.event_end && now.purge_after === original.purge_after, 'Einstellungen nicht zurückgesetzt');
  });

  await step('8a Druckansicht und Sicherung als Datei', async () => {
    await openView(orga.page, 'settings');
    await orga.page.getByRole('button', { name: 'Druckansicht' }).click();
    await orga.page.locator('.print-view').waitFor();
    const rows = await orga.page.locator('.ptable tbody tr').count();
    expect(rows >= 64, 'Zeilen in der Druckansicht: ' + rows);
    expect((await orga.page.locator('.print-view').innerText()).includes('Test Anna'), 'Namen fehlen');
    await shot(orga.page, 'orga-druckansicht');
    await orga.page.getByRole('button', { name: 'Zurück' }).click();
    await orga.page.getByRole('button', { name: 'Plan als Datei sichern' }).click();
    const [download] = await Promise.all([
      orga.page.waitForEvent('download', { timeout: 8000 }),
      orga.page.getByRole('dialog').getByRole('button', { name: 'Datei speichern' }).click(),
    ]);
    const file = path.join(OUT, 'export.json');
    await download.saveAs(file);
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    fs.unlinkSync(file);
    expect(data.helpers.length >= 2 && data.shifts.length >= 64, 'Sicherung unvollständig');
    expect(!/login_code|auth_user|token/i.test(JSON.stringify(data)), 'Sicherung enthält Zugangsdaten');
    return rows + ' Zeilen, Sicherung mit ' + data.helpers.length + ' Helfern';
  });

  await step('8b „Testdaten entfernen“: Plan ist leer, Testhelfer sind draußen', async () => {
    await openView(orga.page, 'settings');
    await orga.page.getByRole('button', { name: 'Testdaten entfernen' }).click();
    const sure = await orga.page.getByRole('dialog').innerText();
    expect(['Test Anna', 'Test Ben', 'Test Cleo', 'Test Dora', 'Test Emil'].every((n) => sure.includes(n)) && /Entfernt 5 Testhelfer/.test(sure), 'Dialog nennt nicht, wer entfernt wird: ' + sure);
    await orga.page.getByRole('dialog').getByRole('button', { name: 'Testdaten entfernen' }).click();
    await orga.page.locator('.notice.info').waitFor({ timeout: 8000 });
    await until(async () => (await orga.page.locator('.stat-pill').innerText()).startsWith('0/'), LIMIT, 'Plan leer');
    expect(await orga.page.locator('.mini-h').count() === 0, 'Helfer noch vorhanden');
    await openView(orga.page, 'board');
    expect(await orga.page.locator('.card .person').count() === 0, 'Zuweisungen noch vorhanden');
    await shot(orga.page, 'orga-board-wieder-leer');
    await until(async () => (await anna.page.locator('.login-box').count()) > 0 && (await ben.page.locator('.login-box').count()) > 0, LIMIT, 'Sitzungen der Testhelfer enden');
    anna.netNoise.length = 0; ben.netNoise.length = 0; // Ablehnung nach dem Entfernen war Absicht
  });

  await step('9 Keine Skriptfehler, keine Anfragen an Dritte', async () => {
    const app = new URL(BASE).origin;
    const backend = await orga.page.evaluate(() => new URL(window.HP_CONFIG.supabaseUrl).origin);
    const problems = [];
    for (const p of Object.values(profiles)) {
      const foreign = Array.from(p.origins).filter((o) => o !== app && o !== backend && o !== 'null');
      if (foreign.length) problems.push(p.name + ' → Dritte: ' + foreign.join(', '));
      if (p.scriptErrors.length) problems.push(p.name + ' → ' + p.scriptErrors.slice(0, 3).join(' | '));
      if (p.netNoise.length) problems.push(p.name + ' → unerwartete Netzmeldungen: ' + p.netNoise.slice(0, 3).join(' | '));
    }
    expect(problems.length === 0, problems.join(' ; '));
    return 'Herkünfte: ' + [app, backend].filter((v, i, a) => a.indexOf(v) === i).join(', ');
  });

  await browser.close();
  const red = results.filter((r) => !r.ok).length;
  fs.writeFileSync(path.join(OUT, 'ergebnis.json'), JSON.stringify({ base: BASE, at: new Date().toISOString(), results }, null, 2));
  console.log('\n' + (results.length - red) + ' von ' + results.length + ' Schritten grün' + (red ? ', ' + red + ' rot' : ''));
  process.exit(red ? 1 : 0);
})().catch((e) => { console.error('Abbruch:', e); process.exit(2); });
