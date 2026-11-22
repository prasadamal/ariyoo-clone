-- Where a moment was, as state/province and ISO country code, looked up on the phone from its location.
-- Powers "states and countries visited" on the You tab. Nullable; older moments are filled in lazily.
alter table public.entries add column if not exists region text check (region is null or char_length(region) <= 80);
alter table public.entries add column if not exists country_code text check (country_code is null or country_code ~ '^[A-Z]{2}$');
