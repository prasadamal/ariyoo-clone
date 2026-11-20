-- An expense can be tied to the journal moment it was spent at (for example a meal). Optional:
-- existing expenses stay as they are, with no moment. If the moment is deleted the expense stays
-- (the money was still spent) and simply loses the link.
alter table public.expenses
  add column if not exists entry_id uuid references public.entries (id) on delete set null;

create index if not exists expenses_entry_idx on public.expenses (entry_id) where entry_id is not null;
