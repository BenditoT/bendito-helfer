-- Bendito Helferplan — Schichtraster 2026 (ersetzt das Raster aus 0005)
-- Stand 25.10.2026. 42 Schichten: Pflichtschichten nach Programm benditotango.de + Plan 2025,
-- dazu nur die Springer-Schichten, die im Plan besetzt sind. Keine Namen in dieser Datei.
-- Läuft nur, wenn echte Helfer noch keine Zuweisungen haben und kein Tausch existiert.
-- Zuweisungen von Testhelfern (is_test) verschwinden mit dem alten Raster (on delete cascade).
begin;
do $$
begin
  if exists (select 1 from public.hp_assignments a join public.hp_helpers h on h.id = a.helper_id where not h.is_test) then
    raise exception 'Abbruch: Es gibt schon Zuweisungen echter Helfer. Raster nicht ersetzen.';
  end if;
  if exists (select 1 from public.hp_swaps) then
    raise exception 'Abbruch: Es gibt Tauschvorgänge (auch Test). Erst prüfen, dann Testtausch löschen.';
  end if;
end $$;
delete from public.hp_shifts;
insert into public.hp_shifts (id, day, type_key, start_time, duration_min, capacity, sort) values
  ('fb1', 'fri', 'bar', '17:30', 90, 1, 10),
  ('fbw', 'fri', 'bettw', '17:30', 60, 1, 20),
  ('fci1', 'fri', 'checkin', '17:30', 90, 1, 30),
  ('fb2', 'fri', 'bar', '19:00', 60, 1, 40),
  ('fci2', 'fri', 'checkin', '19:00', 90, 1, 50),
  ('fdin', 'fri', 'dinner', '19:00', 120, 1, 60),
  ('fb3', 'fri', 'bar', '20:00', 90, 1, 70),
  ('fb4', 'fri', 'bar', '21:30', 90, 1, 80),
  ('fsp4', 'fri', 'springer', '21:30', 90, 1, 90),
  ('fb5', 'fri', 'bar', '23:00', 90, 1, 100),
  ('fb6', 'fri', 'bar', '00:30', 90, 1, 110),
  ('fab', 'fri', 'abbau', '02:00', 60, 1, 120),
  ('sku', 'sat', 'kueche', '09:00', 90, 1, 130),
  ('sb1', 'sat', 'bar', '10:00', 90, 1, 140),
  ('sbr1', 'sat', 'brunch', '10:00', 90, 1, 150),
  ('sb2', 'sat', 'bar', '11:30', 90, 1, 160),
  ('sbr2', 'sat', 'brunch', '11:30', 90, 1, 170),
  ('ssp', 'sat', 'spuelen', '12:00', 90, 1, 180),
  ('sb3', 'sat', 'bar', '13:00', 90, 1, 190),
  ('ssp3', 'sat', 'springer', '13:00', 90, 1, 200),
  ('sb4', 'sat', 'bar', '14:30', 90, 1, 210),
  ('skuch', 'sat', 'kuchen', '14:30', 90, 1, 220),
  ('sb5', 'sat', 'bar', '16:00', 90, 1, 230),
  ('ssp5', 'sat', 'springer', '16:00', 90, 1, 240),
  ('sb6', 'sat', 'bar', '17:30', 90, 1, 250),
  ('skon', 'sat', 'konzert', '18:00', 90, 1, 260),
  ('sdin', 'sat', 'dinner', '18:30', 120, 1, 270),
  ('sb7', 'sat', 'bar', '19:00', 90, 1, 280),
  ('sb8', 'sat', 'bar', '22:30', 90, 1, 290),
  ('ssp8', 'sat', 'springer', '22:30', 90, 1, 300),
  ('sb9', 'sat', 'bar', '00:00', 90, 1, 310),
  ('sb10', 'sat', 'bar', '01:30', 90, 1, 320),
  ('sab', 'sat', 'abbau', '03:00', 60, 1, 330),
  ('uku', 'sun', 'kueche', '09:00', 90, 1, 340),
  ('ub1', 'sun', 'bar', '10:00', 90, 1, 350),
  ('ubr1', 'sun', 'brunch', '10:00', 90, 1, 360),
  ('ub2', 'sun', 'bar', '11:30', 90, 1, 370),
  ('ubr2', 'sun', 'brunch', '11:30', 90, 1, 380),
  ('usp', 'sun', 'spuelen', '12:00', 90, 1, 390),
  ('ub3', 'sun', 'bar', '13:00', 90, 1, 400),
  ('ub4', 'sun', 'bar', '14:30', 90, 1, 410),
  ('ub5', 'sun', 'bar', '16:00', 90, 1, 420);
do $$ begin
  if (select count(*) from public.hp_shifts) <> 42 then raise exception 'Abbruch: Anzahl Schichten stimmt nicht.'; end if;
end $$;
commit;
