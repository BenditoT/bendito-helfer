-- Bendito Helferplan 5.1.0 — private Mailadressen und Pull-Outbox.
-- Keine historischen Benachrichtigungen nachträglich versenden.
begin;

create table if not exists hp_private.helper_mail (
  helper_id uuid primary key references public.hp_helpers(id) on delete cascade,
  email text not null check (length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  enabled boolean not null default true
);
create table if not exists hp_private.mail_outbox (
  id bigint generated always as identity primary key,
  helper_id uuid not null references public.hp_helpers(id) on delete cascade,
  kind text not null check (kind in ('swap_request','swap_accepted','swap_rejected','swap_cancelled','swap_expired','assigned','unassigned')),
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','sending','sent','failed')),
  tries int not null default 0 check (tries between 0 and 3),
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  sent_at timestamptz
);
create index if not exists hp_mail_queue on hp_private.mail_outbox(status, created_at);
alter table hp_private.helper_mail enable row level security;
alter table hp_private.mail_outbox enable row level security;
revoke all on schema hp_private from public, anon, authenticated;
revoke all on hp_private.helper_mail, hp_private.mail_outbox from public, anon, authenticated, service_role;
revoke all on sequence hp_private.mail_outbox_id_seq from public, anon, authenticated, service_role;

alter table public.hp_notifications drop constraint if exists hp_notifications_kind_check;
alter table public.hp_notifications add constraint hp_notifications_kind_check check
  (kind in ('swap_request','swap_accepted','swap_rejected','swap_cancelled','swap_expired','assigned','unassigned'));
alter table public.hp_notifications add column if not exists shift_id text references public.hp_shifts(id) on delete cascade;

create or replace function hp_private.mail_enqueue()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_payload jsonb;
begin
  if not exists (select 1 from hp_private.helper_mail m join public.hp_helpers h on h.id=m.helper_id
                 where m.helper_id=new.helper_id and m.enabled and h.active) then return new; end if;
  if new.swap_id is not null then
    select jsonb_build_object('swap_id',s.id,'from_shift',s.from_shift,'to_shift',s.to_shift)
      into v_payload from public.hp_swaps s where s.id=new.swap_id;
  else
    v_payload := jsonb_build_object('shift_id',new.shift_id);
  end if;
  insert into hp_private.mail_outbox(helper_id,kind,payload) values (new.helper_id,new.kind,v_payload);
  return new;
end $$;
drop trigger if exists hp_mail_enqueue on public.hp_notifications;
create trigger hp_mail_enqueue after insert on public.hp_notifications for each row execute function hp_private.mail_enqueue();

-- Deaktivieren unterdrückt auch bereits wartende Mails. Reaktivieren schaltet
-- die Mail nicht automatisch wieder ein. Löschen/Purge kaskadiert über helper_id.
create or replace function hp_private.mail_on_deactivate()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not new.active and old.active then
    update hp_private.helper_mail set enabled=false where helper_id=new.id;
    delete from hp_private.mail_outbox where helper_id=new.id and status <> 'sent';
  end if;
  return new;
end $$;
drop trigger if exists hp_mail_deactivate on public.hp_helpers;
create trigger hp_mail_deactivate after update of active on public.hp_helpers for each row execute function hp_private.mail_on_deactivate();

create or replace function public.hp_admin_set_helper_mail(p_helper uuid, p_email text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_email text := lower(btrim(coalesce(p_email,''))); v_previous text;
begin
  perform hp_private.require_admin();
  perform hp_private.touch();
  if not exists (select 1 from public.hp_helpers where id=p_helper and active) then
    return jsonb_build_object('ok',false,'code','NOT_FOUND'); end if;
  select email into v_previous from hp_private.helper_mail where helper_id=p_helper;
  if v_email='' then
    delete from hp_private.helper_mail where helper_id=p_helper;
  elsif length(v_email)>254 or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    return jsonb_build_object('ok',false,'code','INVALID_INPUT');
  else
    insert into hp_private.helper_mail(helper_id,email) values(p_helper,v_email)
      on conflict(helper_id) do update set email=excluded.email;
    -- Vorhandenes Opt-out bleibt beim Ändern einer Adresse erhalten.
  end if;
  if v_previous is distinct from nullif(v_email,'') then
    delete from hp_private.mail_outbox where helper_id=p_helper and status <> 'sent';
  end if;
  perform hp_private.audit('set_helper_mail',null,p_helper,'ok');
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.hp_admin_helper_mail_list()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform hp_private.require_admin();
  return (select coalesce(jsonb_agg(jsonb_build_object('helper_id',h.id,'has_mail',m.helper_id is not null,
                    'enabled',coalesce(m.enabled,false) and h.active) order by h.id),'[]'::jsonb)
          from public.hp_helpers h left join hp_private.helper_mail m on m.helper_id=h.id);
end $$;

-- NULL liest den Status; true/false ändert ausschließlich die eigene Einstellung.
create or replace function public.hp_my_mail_enabled(p_on boolean default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_me uuid := hp_private.helper_id(); v_enabled boolean;
begin
  if v_me is null then raise exception 'NOT_ALLOWED' using errcode='42501'; end if;
  perform hp_private.touch();
  if p_on is not null then
    update hp_private.helper_mail set enabled=p_on where helper_id=v_me;
    if not p_on then delete from hp_private.mail_outbox where helper_id=v_me and status <> 'sent'; end if;
  end if;
  select enabled into v_enabled from hp_private.helper_mail where helper_id=v_me;
  return jsonb_build_object('ok',true,'has_mail',v_enabled is not null,'enabled',coalesce(v_enabled,false));
end $$;

create or replace function public.hp_admin_set_mail_secret_hash(p_hash text)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform hp_private.require_admin();
  if p_hash is null or p_hash !~ '^[0-9a-f]{64}$' then return jsonb_build_object('ok',false,'code','INVALID_INPUT'); end if;
  insert into public.hp_settings(key,value) values('mail_secret_hash',to_jsonb(p_hash))
    on conflict(key) do update set value=excluded.value,updated_at=now();
  perform hp_private.audit('set_mail_secret_hash',null,null,'ok');
  return jsonb_build_object('ok',true);
end $$;

-- Nur Prüfsummen der Absenderkennung, niemals Geheimnis oder Mailadresse loggen.
create or replace function hp_private.mail_authorized(p_secret text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_expected text; v_headers jsonb; v_ip text; v_key text;
begin
  -- Serialisiert den Fehlversuchszähler (auch bei gleichzeitigem Claim/Done).
  perform pg_advisory_xact_lock(510009,1);
  delete from public.hp_login_attempts where ip_hash like 'mail:%' and at < now()-interval '1 day';
  v_headers := coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;
  v_ip := coalesce(v_headers->>'x-real-ip',split_part(v_headers->>'x-forwarded-for',',',1),'unknown');
  v_key := 'mail:' || hp_private.code_hash(v_ip);
  select value #>> '{}' into v_expected from public.hp_settings where key='mail_secret_hash';
  -- Ein gültiges starkes Geheimnis bleibt auch nach fremden Fehlversuchen nutzbar.
  if length(p_secret) between 32 and 512 and v_expected is not null
     and hp_private.code_hash(p_secret)=v_expected then return true; end if;
  if (select count(*) from public.hp_login_attempts where ip_hash=v_key and not ok and at>now()-interval '10 minutes') < 10 then
    insert into public.hp_login_attempts(ip_hash,ok) values(v_key,false);
  end if;
  return false;
end $$;

create or replace function hp_private.mail_shift(p_shift text)
returns text language sql stable security definer set search_path = '' as $$
  select coalesce((select
    case s.day when 'fri' then 'Freitag' when 'sat' then 'Samstag' else 'Sonntag' end ||
    case when s.start_time < time '06:00' then case s.day when 'fri' then ' (Nacht auf Samstag)' when 'sat' then ' (Nacht auf Sonntag)' else ' (Nacht auf Montag)' end else '' end ||
    ' ' || to_char(s.start_time,'HH24:MI') || ' Uhr, ' ||
    case s.type_key when 'bar' then 'Bar' when 'aufbau' then 'Aufbau' when 'fr-aufbau' then 'Freitag Aufbau'
      when 'checkin' then 'Check-In' when 'brunch' then 'Brunch-Service' when 'kueche' then 'Küche'
      when 'spuelen' then 'Spülen' when 'abbau' then 'Abbau' when 'springer' then 'Springer'
      when 'einkauf' then 'Einkauf' when 'helferessen' then 'Helferessen' when 'team' then 'Teamtreffen'
      when 'sekt' then 'Sektempfang' when 'bettw' then 'Bettwäsche' when 'konzert' then 'Konzert/Kerzen'
      else s.type_key end
    from public.hp_shifts s where s.id=p_shift),'Schicht im Helferplan');
$$;

create or replace function public.hp_mail_claim(p_secret text, p_limit int default 20)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r record; q record; v_ids bigint[]; v_result jsonb := '[]'; v_text text; v_line text;
        v_first text; v_other text; v_remaining int := least(greatest(coalesce(p_limit,20),1),100);
begin
  if not hp_private.mail_authorized(p_secret) then return '[]'::jsonb; end if;
  -- Ein Claim gleichzeitig; identische Gruppen können nicht doppelt abgeholt werden.
  perform pg_advisory_xact_lock(510009,2);
  delete from hp_private.mail_outbox where status='sent' and sent_at < now()-interval '7 days';
  -- Unklarer Versand nach einem abgebrochenen Poller: keine automatische Doppelmail.
  update hp_private.mail_outbox set status='failed',tries=3
    where status='sending' and claimed_at < now()-interval '10 minutes';
  for r in
    select o.helper_id,min(o.created_at) as first_at
      from hp_private.mail_outbox o join hp_private.helper_mail m on m.helper_id=o.helper_id
      join public.hp_helpers h on h.id=o.helper_id
      where o.status in ('pending','failed') and o.tries<3 and m.enabled and h.active
      group by o.helper_id having min(o.created_at) <= now()-interval '1 minute'
      order by min(o.created_at),o.helper_id
  loop
    exit when v_remaining<=0;
    select array_agg(x.id order by x.id) into v_ids from (
      select o.id from hp_private.mail_outbox o
      where o.helper_id=r.helper_id and o.status in ('pending','failed') and o.tries<3
        and o.created_at <= r.first_at+interval '2 minutes'
      order by o.id limit v_remaining
    ) x;
    v_text := ''; v_first := null;
    for q in select * from hp_private.mail_outbox where id=any(v_ids) order by id loop
      v_other := null;
      if q.kind='swap_request' then
        select split_part(btrim(h.display_name),' ',1) into v_other
          from public.hp_swaps s join public.hp_helpers h on h.id=s.from_helper
          where s.id=(q.payload->>'swap_id')::bigint;
      end if;
      v_line := case q.kind
        when 'swap_request' then coalesce(v_other,'Jemand') || ' fragt einen Tausch an: ' || hp_private.mail_shift(q.payload->>'from_shift') || ' gegen ' || hp_private.mail_shift(q.payload->>'to_shift') || '.'
        when 'swap_accepted' then 'Dein Tausch wurde angenommen: ' || hp_private.mail_shift(q.payload->>'from_shift') || ' gegen ' || hp_private.mail_shift(q.payload->>'to_shift') || '.'
        when 'swap_rejected' then 'Deine Tauschanfrage wurde abgelehnt: ' || hp_private.mail_shift(q.payload->>'from_shift') || ' gegen ' || hp_private.mail_shift(q.payload->>'to_shift') || '.'
        when 'swap_cancelled' then 'Eine Tauschanfrage wurde zurückgezogen: ' || hp_private.mail_shift(q.payload->>'from_shift') || ' gegen ' || hp_private.mail_shift(q.payload->>'to_shift') || '.'
        when 'swap_expired' then 'Deine Tauschanfrage ist nicht mehr ausführbar: ' || hp_private.mail_shift(q.payload->>'from_shift') || ' gegen ' || hp_private.mail_shift(q.payload->>'to_shift') || '.'
        when 'assigned' then 'Die Orga hat dir eine Schicht zugewiesen: ' || hp_private.mail_shift(q.payload->>'shift_id') || '.'
        when 'unassigned' then 'Die Orga hat dich aus einer Schicht genommen: ' || hp_private.mail_shift(q.payload->>'shift_id') || '.' end;
      v_text := v_text || E'\n- ' || v_line;
    end loop;
    update hp_private.mail_outbox set status='sending',tries=tries+1,claimed_at=now() where id=any(v_ids);
    select split_part(btrim(display_name),' ',1) into v_first from public.hp_helpers where id=r.helper_id;
    v_result := v_result || jsonb_build_array(jsonb_build_object('id',v_ids[1],'ids',to_jsonb(v_ids),
      'to',(select email from hp_private.helper_mail where helper_id=r.helper_id),
      'subject','Bendito Helferplan: Tausch und Schichtänderungen',
      'text','Hallo ' || v_first || E',\n' || v_text || E'\n\nÖffne deinen Helferplan über den Link aus deiner Einladungsmail: https://helfer.benditotango.de/\n\nDen aktuellen Stand findest du in deinem Helferplan. Dort kannst du Mail-Benachrichtigungen auch abschalten.\n\nDein Bendito-Team'));
    v_remaining := v_remaining-cardinality(v_ids);
  end loop;
  return v_result;
end $$;

create or replace function public.hp_mail_done(p_secret text,p_ids bigint[],p_ok boolean)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_n int;
begin
  if not hp_private.mail_authorized(p_secret) then return '[]'::jsonb; end if;
  perform pg_advisory_xact_lock(510009,2);
  if p_ok is null or cardinality(p_ids)>100 then return jsonb_build_object('ok',false,'code','INVALID_INPUT'); end if;
  update hp_private.mail_outbox set status=case when p_ok then 'sent' else 'failed' end,
    sent_at=case when p_ok then now() else null end
    where id=any(p_ids) and status='sending';
  get diagnostics v_n=row_count;
  return jsonb_build_object('ok',true,'updated',v_n);
end $$;

-- Bestehende RPCs: explizite Orga-Meldungen, kein Assignment-Trigger beim Tausch.
create or replace function public.hp_admin_assign(p_shift text, p_helper uuid, p_force boolean default false)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_shift public.hp_shifts;
  v_helper public.hp_helpers;
  v_n int;
  v_conflict text;
begin
  perform hp_private.require_admin();
  perform hp_private.touch();

  select * into v_shift from public.hp_shifts where id = p_shift;
  if not found then
    return hp_private.fail('assign', p_shift, p_helper, 'NOT_FOUND');
  end if;
  select * into v_helper from public.hp_helpers where id = p_helper;
  if not found then
    return hp_private.fail('assign', p_shift, p_helper, 'NOT_FOUND');
  end if;
  if not v_helper.active then
    return hp_private.fail('assign', p_shift, p_helper, 'HELPER_INACTIVE');
  end if;
  if exists (select 1 from public.hp_assignments a where a.shift_id = p_shift and a.helper_id = p_helper) then
    return hp_private.fail('assign', p_shift, p_helper, 'ASSIGN_DUPLICATE');
  end if;
  select count(*) into v_n from public.hp_assignments a where a.shift_id = p_shift;
  if v_n >= v_shift.capacity then
    return hp_private.fail('assign', p_shift, p_helper, 'SHIFT_FULL');
  end if;

  v_conflict := hp_private.conflict(p_helper, p_shift, null);
  if v_conflict is not null and not coalesce(p_force, false) then
    perform hp_private.audit('assign', p_shift, p_helper, 'ASSIGN_OVERLAP');
    return jsonb_build_object('ok', false, 'code', 'ASSIGN_OVERLAP', 'conflict_shift', v_conflict);
  end if;

  insert into public.hp_assignments (shift_id, helper_id, assigned_by)
  values (p_shift, p_helper, (select auth.uid()));
  insert into public.hp_notifications(helper_id,kind,shift_id) values(p_helper,'assigned',p_shift);
  perform hp_private.sweep();
  perform hp_private.audit('assign', p_shift, p_helper, case when v_conflict is null then 'ok' else 'ok_forced' end);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.hp_admin_unassign(p_shift text, p_helper uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
begin
  perform hp_private.require_admin();
  perform hp_private.touch();

  delete from public.hp_assignments a where a.shift_id = p_shift and a.helper_id = p_helper;
  if not found then
    return hp_private.fail('unassign', p_shift, p_helper, 'NOT_FOUND');
  end if;
  insert into public.hp_notifications(helper_id,kind,shift_id) values(p_helper,'unassigned',p_shift);
  -- Offene Tauschvorgänge zu dieser Zuweisung verfallen.
  perform hp_private.sweep();
  perform hp_private.audit('unassign', p_shift, p_helper, 'ok');
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.hp_state()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_admin boolean := hp_private.is_admin();
  v_me uuid := hp_private.helper_id();
  v jsonb;
begin
  if v_admin then
    v_me := null;
  elsif v_me is null then
    raise exception 'NOT_ALLOWED' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'ctx', public.hp_my_context(),
    'settings', jsonb_build_object(
      'target_shifts', (select s.value from public.hp_settings s where s.key = 'target_shifts'),
      'target_hours', (select s.value from public.hp_settings s where s.key = 'target_hours'),
      'swaps_locked', (select s.value from public.hp_settings s where s.key = 'swaps_locked'),
      'swaps_lock_at', (select s.value from public.hp_settings s where s.key = 'swaps_lock_at'),
      'event_end', (select s.value from public.hp_settings s where s.key = 'event_end'),
      'purge_after', (select s.value from public.hp_settings s where s.key = 'purge_after'),
      'locked', hp_private.locked()
    ),
    'helpers', coalesce((
      select jsonb_agg(
        case when v_admin then
          jsonb_build_object(
            'id', h.id, 'display_name', h.display_name, 'color', h.color,
            'contact_channel', h.contact_channel, 'is_setup_team', h.is_setup_team,
            'target_shifts', h.target_shifts, 'active', h.active, 'is_test', h.is_test,
            'has_login', h.login_code_hash is not null,
            'login_code_created_at', h.login_code_created_at,
            'signed_in', h.auth_user_id is not null)
        else
          jsonb_build_object(
            'id', h.id, 'display_name', h.display_name, 'color', h.color,
            'contact_channel', h.contact_channel, 'is_setup_team', h.is_setup_team,
            'target_shifts', h.target_shifts, 'active', true)
        end
        order by lower(h.display_name))
      from public.hp_helpers h
      where v_admin or h.active
    ), '[]'::jsonb),
    'shifts', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', s.id, 'day', s.day, 'type_key', s.type_key,
          'start_time', to_char(s.start_time, 'HH24:MI'),
          'duration_min', s.duration_min, 'capacity', s.capacity,
          'start_min', s.start_min, 'end_min', s.end_min)
        order by s.sort, s.id)
      from public.hp_shifts s
    ), '[]'::jsonb),
    'assignments', coalesce((
      select jsonb_agg(jsonb_build_object('shift_id', a.shift_id, 'helper_id', a.helper_id)
                       order by a.shift_id, a.assigned_at)
      from public.hp_assignments a
    ), '[]'::jsonb),
    'swaps', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', w.id, 'kind', w.kind, 'from_helper', w.from_helper,
          'from_shift', w.from_shift, 'to_shift', w.to_shift, 'note', w.note,
          'status', w.status, 'accepted_by', w.accepted_by,
          'created_at', w.created_at, 'resolved_at', w.resolved_at)
        order by w.created_at desc, w.id desc)
      from public.hp_swaps w
      where v_admin
         or w.from_helper = v_me
         or w.accepted_by = v_me
         or exists (select 1 from public.hp_notifications n
                    where n.swap_id = w.id and n.helper_id = v_me)
         or (w.status = 'pending' and w.kind = 'swap' and exists (
               select 1 from public.hp_assignments a
               where a.shift_id = w.to_shift and a.helper_id = v_me))
    ), '[]'::jsonb),
    'notifications', coalesce((
      select jsonb_agg(
        jsonb_build_object('id', n.id, 'kind', n.kind, 'swap_id', n.swap_id, 'shift_id', n.shift_id,
                           'created_at', n.created_at, 'read_at', n.read_at)
        order by n.created_at desc, n.id desc)
      from public.hp_notifications n
      where n.helper_id = v_me
    ), '[]'::jsonb)
  ) into v;

  return v;
end;
$$;

-- Nur neue Funktionen beschränken, bestehende Rechte bleiben erhalten.
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where (n.nspname='hp_private' and p.proname like 'mail_%')
       or (n.nspname='public' and p.proname in ('hp_admin_set_helper_mail','hp_admin_helper_mail_list',
         'hp_my_mail_enabled','hp_admin_set_mail_secret_hash','hp_mail_claim','hp_mail_done'))
  loop execute format('revoke all on function %s from public,anon,authenticated,service_role',f.sig); end loop;
end $$;
grant execute on function public.hp_admin_set_helper_mail(uuid,text), public.hp_admin_helper_mail_list(),
  public.hp_my_mail_enabled(boolean), public.hp_admin_set_mail_secret_hash(text) to authenticated;
grant execute on function public.hp_mail_claim(text,int), public.hp_mail_done(text,bigint[],boolean) to anon;
notify pgrst, 'reload schema';
commit;
