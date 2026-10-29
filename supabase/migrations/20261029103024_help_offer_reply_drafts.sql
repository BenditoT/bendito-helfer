begin;
alter table public.hp_help_offers
  add column reply_subject text not null default '' check (length(reply_subject) <= 200 and reply_subject !~ E'[\r\n]'),
  add column reply_body text not null default '' check (length(reply_body) <= 5000),
  add column reply_status text not null default 'open' check (reply_status in ('open','draft','done','no_reply')),
  add column reply_revision integer not null default 0,
  add column reply_updated_at timestamptz;

create or replace function public.hp_admin_list_help_offers()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  perform hp_private.require_admin();
  return coalesce((select jsonb_agg(jsonb_build_object(
    'id',o.id,'name',o.display_name,'email',o.email,'phone',o.phone,
    'arrive_thu',o.arrive_thu,'stay_mon',o.stay_mon,'pre_milonga',o.pre_milonga,
    'dinner_sun',o.dinner_sun,'note',o.note,'updated_at',o.updated_at,
    'reply_subject',o.reply_subject,'reply_body',o.reply_body,'reply_status',o.reply_status,
    'reply_revision',o.reply_revision,'reply_updated_at',o.reply_updated_at
  ) order by o.created_at, o.id) from public.hp_help_offers o),'[]'::jsonb);
end;
$$;

create or replace function public.hp_admin_save_offer_reply(
  p_id uuid,p_subject text,p_body text,p_status text,p_revision integer
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_revision integer;
begin
  perform hp_private.require_admin();
  if p_subject is null or p_body is null or p_status is null or p_revision is null
    or length(p_subject)>200 or p_subject ~ E'[\r\n]' or length(p_body)>5000
    or p_status not in ('open','draft','done','no_reply') then
    return jsonb_build_object('ok',false,'code','INVALID_INPUT');
  end if;
  update public.hp_help_offers set reply_subject=p_subject,reply_body=p_body,
    reply_status=p_status,reply_revision=reply_revision+1,reply_updated_at=now()
    where id=p_id and reply_revision=p_revision returning reply_revision into v_revision;
  if not found then return jsonb_build_object('ok',false,'code','CONFLICT'); end if;
  perform hp_private.audit('offer_reply:'||p_status,null,null,'ok');
  return jsonb_build_object('ok',true,'revision',v_revision);
end;
$$;
revoke all on function public.hp_admin_save_offer_reply(uuid,text,text,text,integer) from public,anon,authenticated,service_role;
grant execute on function public.hp_admin_save_offer_reply(uuid,text,text,text,integer) to authenticated;
commit;
