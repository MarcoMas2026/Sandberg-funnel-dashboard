-- Fix: Instagram's IG User ID (17841405678328713) exceeds Number.MAX_SAFE_INTEGER
-- (9007199254740991). Stored as bigint, it round-trips fine into Postgres from a raw
-- HTTP request, but PostgREST's JSON response gets deserialized by any JS client
-- (supabase-js) via JSON.parse, which silently loses precision on numbers this large —
-- every subsequent .eq("account_id", accountId) join then compares a corrupted ID
-- against the exact stored value and returns zero rows. Fix: store all Meta platform
-- IDs as text. They're opaque identifiers, never used arithmetically, so text is both
-- correct and the standard way to handle these across every Graph API integration.

alter table daily_account_snapshots drop constraint if exists daily_account_snapshots_account_id_fkey;
alter table daily_account_insights drop constraint if exists daily_account_insights_account_id_fkey;
alter table media drop constraint if exists media_account_id_fkey;
alter table demographics_snapshots drop constraint if exists demographics_snapshots_account_id_fkey;

alter table ig_accounts alter column id type text;
alter table daily_account_snapshots alter column account_id type text;
alter table daily_account_insights alter column account_id type text;
alter table media alter column account_id type text;
alter table demographics_snapshots alter column account_id type text;

alter table daily_account_snapshots add constraint daily_account_snapshots_account_id_fkey foreign key (account_id) references ig_accounts(id);
alter table daily_account_insights add constraint daily_account_insights_account_id_fkey foreign key (account_id) references ig_accounts(id);
alter table media add constraint media_account_id_fkey foreign key (account_id) references ig_accounts(id);
alter table demographics_snapshots add constraint demographics_snapshots_account_id_fkey foreign key (account_id) references ig_accounts(id);
