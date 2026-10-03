-- Drei synthetische Test-Helfer für den Testlauf im echten Projekt.
-- Keine echten Personen. Die Orga entfernt sie mit „Testdaten entfernen“.
insert into public.hp_helpers (display_name, color, contact_channel, is_test) values
  ('Test Anna', '#4A90D9', 'WhatsApp', true),
  ('Test Ben', '#459C5B', 'Signal', true),
  ('Test Cleo', '#E364A2', 'E-Mail', true)
on conflict do nothing;
