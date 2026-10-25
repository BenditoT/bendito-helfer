import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {parseCsv,matchMails} from '../tools/helfer-mails-import.mjs';
const code=readFileSync(new URL('../tools/mail-poller.gs',import.meta.url),'utf8');
function poller({quota=50,sendFails=false,ackFails=false}={}) {
  const props={HP_MAIL_SECRET:'x'.repeat(64),HP_API_KEY:'public-key',HP_MAIL_ENABLED:'true'};
  const calls=[],sent=[];let batch=[{id:1,ids:[1,2],to:'test@example.invalid',subject:'Test',text:'Test'}];
  const c={
    PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k],setProperty:(k,v)=>props[k]=v,deleteProperty:k=>delete props[k]})},
    Session:{getEffectiveUser:()=>({getEmail:()=> 'benditotango@gmail.com'})},
    LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},
    MailApp:{getRemainingDailyQuota:()=>quota},
    GmailApp:{sendEmail(...args){if(sendFails)throw Error('sensitive response');sent.push(args);}},
    UrlFetchApp:{fetch(url,options){const body=JSON.parse(options.payload);calls.push({url,body});
      if(url.endsWith('hp_mail_done') && ackFails) throw Error('private server response');
      const result=url.endsWith('hp_mail_claim')?batch.splice(0):{ok:true,updated:2};
      return {getResponseCode:()=>200,getContentText:()=>JSON.stringify(result)};
    }}
  };vm.createContext(c);vm.runInContext(code,c);return {c,props,calls,sent,setAckFails:value=>{ackFails=value;}};
}
test('bundled message sends once and acknowledges every ID',()=>{
 const p=poller();p.c.pollMail();assert.equal(p.sent.length,1);assert.deepEqual(p.calls[1].body.p_ids,[1,2]);assert.equal(p.calls[1].body.p_ok,true);assert.equal(p.props.HP_MAIL_ACK,undefined);
});
test('disabled / reserved quota never claims',()=>{
 const p=poller({quota:10});p.c.pollMail();assert.equal(p.calls.length,0);
 p.props.HP_MAIL_ENABLED='false';p.c.pollMail();assert.equal(p.calls.length,0);
});
test('failed send acknowledges failure without leaking exception',()=>{
 const p=poller({sendFails:true});p.c.pollMail();assert.equal(p.calls[1].body.p_ok,false);assert.equal(p.sent.length,0);
});
test('ack failure persists sent state and does not resend',()=>{
 const p=poller({ackFails:true});assert.throws(()=>p.c.pollMail(),/nicht erreichbar/);assert.equal(JSON.parse(p.props.HP_MAIL_ACK).ok,true);
 assert.throws(()=>p.c.pollMail());assert.equal(p.sent.length,1);
});
test('crash during send stops for manual reconciliation',()=>{
 const p=poller();p.props.HP_MAIL_ACK=JSON.stringify({ids:[1],phase:'sending',ok:false});
 assert.throws(()=>p.c.pollMail(),/Versandstatus unklar/);assert.equal(p.calls.length,0);assert.equal(p.sent.length,0);
});
test('CSV quoted multiline fields and unique short-name matching',()=>{
 assert.deepEqual(parseCsv('\uFEFFName;E-Mail;Note\r\n"Beta Sample";test@example.invalid;"a; b\nZeile"'),[['Name','E-Mail','Note'],['Beta Sample','test@example.invalid','a; b\nZeile']]);
 const helpers=Array.from({length:8},(_,i)=>({id:String(i),active:true,display_name:i===0?'Test A.':i===1?'Beta':'Person '+i}));
 const rows=[['Name','E-Mail'],...helpers.map((h,i)=>[i===0?'Test Alpha':i===1?'Beta Sample':h.display_name,`test${i}@example.invalid`])];
 assert.equal(matchMails(rows,helpers).length,8);
 assert.throws(()=>matchMails([...rows,rows[1]],helpers),/mehrdeutig/);
 rows[2][1]=rows[1][1];assert.throws(()=>matchMails(rows,helpers),/Doppelte/);
});

test('recovery acknowledges the sent group then releases unattempted groups',()=>{
 const p=poller({ackFails:true});assert.throws(()=>p.c.pollMail());
 p.props.HP_MAIL_UNSENT=JSON.stringify([3,4]);p.setAckFails(false);p.c.pollMail();
 assert.equal(p.sent.length,1);assert.equal(p.props.HP_MAIL_ACK,undefined);assert.equal(p.props.HP_MAIL_UNSENT,undefined);
 assert.deepEqual(p.calls.slice(-3).map(x=>[x.url.split('/').at(-1),x.body.p_ok]),[['hp_mail_done',true],['hp_mail_done',false],['hp_mail_claim',undefined]]);
});
test('personal account cannot call or send',()=>{
 const p=poller();p.c.Session.getEffectiveUser=()=>({getEmail:()=> 'personal@example.invalid'});
 assert.throws(()=>p.c.pollMail(),/Bendito-Konto/);assert.equal(p.calls.length,0);assert.equal(p.sent.length,0);
});
test('delimiter ignores punctuation inside quoted question headers',()=>{
 const rows=parseCsv('Name;E-Mail;"Question, with, commas, inside"\nBeta Sample;test@example.invalid;yes');
 assert.equal(rows[0].length,3);assert.equal(rows[1][0],'Beta Sample');
});
test('temporary test activation fails closed when trigger creation fails',()=>{
 const p=poller();p.props.HP_MAIL_ENABLED='false';
 p.c.ScriptApp={getProjectTriggers:()=>[],newTrigger:()=>({timeBased:()=>({everyMinutes:()=>({create(){throw Error('trigger failed');}})})})};
 assert.throws(()=>p.c.startMailTest(),/trigger failed/);assert.equal(p.props.HP_MAIL_ENABLED,'false');
});
test('stopping the temporary test disables mail and removes only pollMail triggers',()=>{
 const p=poller();const removed=[];
 const own={getHandlerFunction:()=> 'pollMail'},other={getHandlerFunction:()=> 'unrelated'};
 p.c.ScriptApp={getProjectTriggers:()=>[own,other],deleteTrigger:trigger=>removed.push(trigger)};
 p.c.stopMailTest();assert.equal(p.props.HP_MAIL_ENABLED,'false');assert.deepEqual(removed,[own]);
});
