#!/usr/bin/env node
// CSV bleibt lokal außerhalb des Repos. Ausgabe enthält weder Namen noch Adressen.
import {readFile} from 'node:fs/promises';
import {resolve, relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createInterface} from 'node:readline/promises';
import {stdin, stdout} from 'node:process';
import vm from 'node:vm';

export function parseCsv(text) {
  text = text.replace(/^\uFEFF/, '');
  const head = text.split(/\r?\n/, 1)[0];
  const counts=new Map([[';',0],[',',0],['\t',0]]); let inQuotes=false;
  for(let i=0;i<head.length;i++) {if(head[i]==='\"') {if(inQuotes && head[i+1]==='\"') i++; else inQuotes=!inQuotes;}
    else if(!inQuotes && counts.has(head[i])) counts.set(head[i],counts.get(head[i])+1);}
  const delimiter = [...counts].sort((a,b)=>b[1]-a[1])[0][0];
  const rows=[]; let row=[], field='', quoted=false;
  for (let i=0; i<text.length; i++) {
    const c=text[i];
    if(c==='"') {
      if(quoted && text[i+1]==='"') {field+='"'; i++;} else quoted=!quoted;
    } else if(c===delimiter && !quoted) {row.push(field);field='';}
    else if((c==='\n'||c==='\r') && !quoted) {
      if(c==='\r' && text[i+1]==='\n') i++;
      row.push(field); if(row.some(x=>x.trim())) rows.push(row);row=[];field='';
    } else field+=c;
  }
  if(quoted) throw new Error('CSV-Anführungszeichen nicht geschlossen.');
  row.push(field);if(row.some(x=>x.trim())) rows.push(row);
  if(rows.length<2 || rows.some(r=>r.length!==rows[0].length)) throw new Error('CSV-Aufbau uneinheitlich.');
  return rows;
}
const norm = x => x.normalize('NFKC').trim().toLocaleLowerCase('de').replace(/\s+/g,' ');
function matchesName(displayName, sourceName) {
  const display=norm(displayName), source=norm(sourceName);
  if(display===source) return true;
  const d=display.split(' '), n=source.split(' ');
  if(d.length===1) return n[0]===d[0];
  return d.length===2 && /^[a-zäöü]\.$/u.test(d[1]) && n.length>=2 && n[0]===d[0] && n.at(-1).startsWith(d[1][0]);
}
export function matchMails(rows, helpers, nameColumn, emailColumn) {
  const header=rows[0].map(norm);
  function column(explicit,pattern) {
    const matches=header.flatMap((h,i)=>(explicit? h===norm(explicit):pattern.test(h))?[i]:[]);
    if(matches.length!==1) throw new Error('Spalten nicht eindeutig. --name-column und --email-column angeben.');
    return matches[0];
  }
  const ni=column(nameColumn,/^(name|vor-? und nachname|vorname und nachname|dein name|full name|name und nachname)$/);
  const ei=column(emailColumn,/^(e-?mail(-adresse| address)?|emailadresse|deine e-?mail(-adresse)?|e-mail-adresse)$/);
  const targets=helpers.filter(h=>h.active && !h.is_test);
  if(targets.length!==8) throw new Error('Erwartet werden genau acht aktive echte Helfer.');
  const matches=targets.map(h=>{
    const source=rows.slice(1).filter(r=>matchesName(h.display_name,r[ni]));
    if(source.length!==1) throw new Error('Zuordnung fehlt oder ist mehrdeutig; keine Änderung vorgenommen.');
    const email=source[0][ei].trim().toLowerCase();
    if(email.length>254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error('Ungültige Adresse; keine Änderung vorgenommen.');
    return {helper_id:h.id,email};
  });
  if(new Set(matches.map(m=>m.email)).size!==matches.length) throw new Error('Doppelte Adresse; Zuordnung prüfen.');
  return matches;
}
async function hiddenInput(prompt) {
  if(!stdin.isTTY) throw new Error('Orga-Token über HP_ADMIN_TOKEN bereitstellen oder interaktives Terminal verwenden.');
  stdout.write(prompt); stdin.setRawMode(true);stdin.resume();
  return new Promise((resolve,reject)=>{
    let value='';
    function finish(err) {stdin.off('data',onData);stdin.setRawMode(false);stdin.pause();stdout.write('\n');err?reject(err):resolve(value);}
    function onData(buffer) {
      for(const c of buffer.toString()) {
        if(c==='\u0003') return finish(new Error('Abgebrochen.'));
        if(c==='\r'||c==='\n') return finish();
        if(c==='\u007f') value=value.slice(0,-1);else value+=c;
      }
    }
    stdin.on('data',onData);
  });
}
async function main() {
  const args=process.argv.slice(2), path=args.shift();
  if(!path) throw new Error('Aufruf: node tools/helfer-mails-import.mjs /privater/pfad.csv [--dry-run] [--name-column Spalte] [--email-column Spalte]');
  let dry=false, nc, ec;
  while(args.length) {const key=args.shift();if(key==='--dry-run') dry=true;else if(key==='--name-column') nc=args.shift();else if(key==='--email-column') ec=args.shift();else throw new Error('Unbekannte Option.');}
  const repo=resolve(fileURLToPath(new URL('..',import.meta.url)));
  const rel=relative(repo,resolve(path));
  if(!rel.startsWith('..') && !rel.startsWith('/')) throw new Error('CSV muss außerhalb des Repos liegen.');
  const rows=parseCsv(await readFile(path,'utf8'));
  const context={window:{}};vm.runInNewContext(await readFile(new URL('../config.js',import.meta.url),'utf8'),context);
  const config=context.window.HP_CONFIG;
  async function request(endpoint,body,token) {
    let response;
    try {response=await fetch(config.supabaseUrl+endpoint,{method:'POST',headers:{apikey:config.supabaseAnonKey,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});}
    catch {throw new Error('Datenbank nicht erreichbar.');}
    if(!response.ok) throw new Error('Anmeldung oder Datenbankaufruf fehlgeschlagen.');
    try {return await response.json();} catch {throw new Error('Datenbankantwort nicht lesbar.');}
  }
  let token=process.env.HP_ADMIN_TOKEN;
  if(!token) {
    const email=await hiddenInput('Orga-E-Mail (verdeckt): ');
    const password=await hiddenInput('Orga-Passwort (verdeckt): ');
    token=(await request('/auth/v1/token?grant_type=password',{email,password})).access_token;
    if(!token) throw new Error('Keine Orga-Sitzung erhalten.');
  }
  const state=await request('/rest/v1/rpc/hp_state',{},token);
  if(state.ctx?.role!=='admin') throw new Error('Orga-Anmeldung erforderlich.');
  const matches=matchMails(rows,state.helpers,nc,ec);
  if(dry) {stdout.write('8 von 8 zugeordnet (Prüflauf, nichts gespeichert).\n');return;}
  let written=0;
  for(const match of matches) {
    let result;
    try {result=await request('/rest/v1/rpc/hp_admin_set_helper_mail',{p_helper:match.helper_id,p_email:match.email},token);}
    catch {throw new Error(`Import nach ${written} bestätigten von 8 gestoppt; letzter Aufruf unklar. Nach Prüfung erneut ausführen.`);}
    if(!result.ok) throw new Error(`Import nach ${written} von 8 gestoppt. Nach Korrektur erneut ausführen.`);
    written++;
  }
  stdout.write('8 von 8 zugeordnet.\n');
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  main().catch(error=>{process.stderr.write(error.message+'\n');process.exitCode=1;});
}
