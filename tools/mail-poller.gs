/**
 * Bendito Helferplan — im Konto benditotango@gmail.com ausführen.
 * Script Properties: HP_MAIL_SECRET, HP_API_KEY, HP_MAIL_ENABLED (erst nach Test true).
 * Keine Geheimnisse, Empfänger oder Mailtexte im Ausführungsprotokoll ausgeben.
 */
function mailRpc_(name, body, properties) {
  var response;
  try {
    response = UrlFetchApp.fetch('https://db.benditotango.de/rest/v1/rpc/' + name, {
      method: 'post', contentType: 'application/json',
      headers: {apikey: properties.getProperty('HP_API_KEY')},
      payload: JSON.stringify(body), muteHttpExceptions: true
    });
  } catch (_) { throw new Error('Mail-Datenbank nicht erreichbar.'); }
  if (response.getResponseCode() !== 200) throw new Error('Mail-Datenbank: Abruf fehlgeschlagen.');
  var result;
  try { result = JSON.parse(response.getContentText()); }
  catch (_) { throw new Error('Mail-Datenbank: ungültige Antwort.'); }
  return result;
}

function mailAcknowledge_(entry, properties, secret) {
  var result = mailRpc_('hp_mail_done', {p_secret: secret, p_ids: entry.ids, p_ok: entry.ok}, properties);
  if (!result || result.ok !== true) throw new Error('Mail-Quittung abgelehnt. Konfiguration prüfen.');
  properties.deleteProperty('HP_MAIL_ACK');
}

function pollMail() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    var properties = PropertiesService.getScriptProperties();
    if (Session.getEffectiveUser().getEmail().toLowerCase() !== 'benditotango@gmail.com') {
      throw new Error('Dieses Projekt muss im Bendito-Konto laufen.');
    }
    var secret = properties.getProperty('HP_MAIL_SECRET');
    if (!secret || secret.length < 32 || !properties.getProperty('HP_API_KEY')) {
      throw new Error('Mail-Konfiguration fehlt.');
    }
    // Eine erfolgreiche Sendung erst quittieren, bevor neue abgeholt werden.
    var saved = properties.getProperty('HP_MAIL_ACK');
    if (saved) {
      var ack = JSON.parse(saved);
      if (ack.phase === 'sending') {
        throw new Error('Versandstatus unklar. Trigger stoppen und Gesendet-Ordner prüfen; nicht blind wiederholen.');
      }
      mailAcknowledge_(ack, properties, secret);
    }
    // Sicher ungesendete Restgruppen nach einem Abbruch wieder freigeben.
    var unsent = properties.getProperty('HP_MAIL_UNSENT');
    if (unsent) {
      var released = mailRpc_('hp_mail_done', {p_secret: secret, p_ids: JSON.parse(unsent), p_ok: false}, properties);
      if (!released || released.ok !== true) throw new Error('Wartende Mailgruppen konnten nicht freigegeben werden.');
      properties.deleteProperty('HP_MAIL_UNSENT');
    }
    if (properties.getProperty('HP_MAIL_ENABLED') !== 'true') return;
    var quota = MailApp.getRemainingDailyQuota();
    if (quota <= 10) return;
    var messages = mailRpc_('hp_mail_claim', {p_secret: secret, p_limit: Math.min(20, quota - 10)}, properties);
    if (!Array.isArray(messages)) throw new Error('Mail-Datenbank: ungültiges Format.');
    var remaining = messages.reduce(function(ids, m) { return ids.concat(m.ids || [m.id]); }, []);
    if (remaining.length) properties.setProperty('HP_MAIL_UNSENT', JSON.stringify(remaining));
    for (var i = 0; i < messages.length; i++) {
      var message = messages[i];
      var ids = message.ids || [message.id];
      var entry = {ids: ids, phase: 'sending', ok: false};
      // Nur technische IDs speichern, keine Adresse und keinen Text.
      properties.setProperty('HP_MAIL_ACK', JSON.stringify(entry));
      remaining = remaining.filter(function(id) { return ids.indexOf(id) === -1; });
      if (remaining.length) properties.setProperty('HP_MAIL_UNSENT', JSON.stringify(remaining));
      else properties.deleteProperty('HP_MAIL_UNSENT');
      try {
        GmailApp.sendEmail(message.to, message.subject, message.text, {
          name: 'Bendito Helferplan', replyTo: 'benditotango@gmail.com'
        });
        entry.ok = true;
      } catch (_) {
        entry.ok = false;
      }
      entry.phase = 'done';
      properties.setProperty('HP_MAIL_ACK', JSON.stringify(entry));
      mailAcknowledge_(entry, properties, secret);
    }
  } finally { lock.releaseLock(); }
}

// Erst nach erfolgreichem Testlauf aufrufen. Kein Web-App-Deployment nötig.
function installMailTrigger() {
  var properties = PropertiesService.getScriptProperties();
  if (properties.getProperty('HP_MAIL_ENABLED') !== 'true') throw new Error('Mailversand ist noch ausgeschaltet.');
  if (Session.getEffectiveUser().getEmail().toLowerCase() !== 'benditotango@gmail.com') throw new Error('Bendito-Konto verwenden.');
  var exists = ScriptApp.getProjectTriggers().some(function(t) { return t.getHandlerFunction() === 'pollMail'; });
  if (!exists) ScriptApp.newTrigger('pollMail').timeBased().everyMinutes(1).create();
}

/** Einmal von Norbert im Bendito-Konto ausführen; Geheimnis bleibt in Properties. */
function prepareMailSetup() {
  var properties = PropertiesService.getScriptProperties();
  if (Session.getEffectiveUser().getEmail().toLowerCase() !== 'benditotango@gmail.com') throw new Error('Bendito-Konto verwenden.');
  if (!properties.getProperty('HP_MAIL_SECRET')) {
    properties.setProperty('HP_MAIL_SECRET', (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, ''));
  }
  if (!properties.getProperty('HP_MAIL_ENABLED')) properties.setProperty('HP_MAIL_ENABLED', 'false');
  var hash = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, properties.getProperty('HP_MAIL_SECRET'), Utilities.Charset.UTF_8)
    .map(function(b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
  // Nur die nicht rückrechenbare Prüfsumme, nie das Geheimnis ausgeben.
  console.log('SHA-256 für hp_admin_set_mail_secret_hash: ' + hash);
}

// Nur für den bestätigten Empfangstest; danach stopMailTest aufrufen.
function startMailTest() {
  var properties = PropertiesService.getScriptProperties();
  if (Session.getEffectiveUser().getEmail().toLowerCase() !== 'benditotango@gmail.com') throw new Error('Bendito-Konto verwenden.');
  properties.setProperty('HP_MAIL_ENABLED', 'true');
  try { installMailTrigger(); }
  catch (error) { properties.setProperty('HP_MAIL_ENABLED', 'false'); throw error; }
}

function stopMailTest() {
  PropertiesService.getScriptProperties().setProperty('HP_MAIL_ENABLED', 'false');
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    if (trigger.getHandlerFunction() === 'pollMail') ScriptApp.deleteTrigger(trigger);
  });
}
