/* Postgres / Supabase-ready schema (not used by the demo — the demo reads typed JSON seeds in data/).
 * Run SCHEMA_SQL in Supabase's SQL editor to create the tables when we move off JSON. */
export const SCHEMA_SQL = /* sql */ `
create table landlords (
  id text primary key, name text not null,
  kind text not null check (kind in ('operator','small','house_owner')),
  contact text, launch_partner boolean default false, created_at timestamptz default now()
);

create table listings (
  id text primary key, landlord_id text references landlords(id), building_id text not null,
  source text not null check (source in ('direct','feed','bring_your_own')),
  verified_at date, address text not null, lat double precision, lng double precision,
  beds int not null, baths numeric, sqft int,
  price_basis text not null check (price_basis in ('per_bed','per_unit')), -- required for our own inventory
  price_amount int not null, unit_total int not null,
  required_fees jsonb not null default '[]', optional_fees jsonb not null default '[]',
  utilities_included text[] not null default '{}', utilities_listed int,
  lease_type text not null check (lease_type in ('individual','joint','both')),
  roommate_matching boolean not null default false,
  lease_start date not null, lease_months int[] not null, applications_open_on date not null,
  amenities jsonb not null,
  application_fee int not null check (application_fee <= 50),          -- Ann Arbor cap
  application_fee_refundable boolean not null default true,
  deposit int not null, screening_criteria_url text,
  photos text[] default '{}', landlord_contact text,
  hidden boolean not null default false, report_count int not null default 0,
  created_at timestamptz default now()
);

create table applications (
  id uuid primary key default gen_random_uuid(),
  listing_id text references listings(id), student_ref text not null,
  housing_id jsonb not null,            -- the student's housing ID card, shared with permission
  funding jsonb not null,               -- self-reported; never SSN, credit report or criminal history
  status text not null default 'submitted', created_at timestamptz default now()
);

create table leads (
  id uuid primary key default gen_random_uuid(), listing_id text references listings(id),
  budget int, move_in date, group_desc text, guarantor text, reasons text[], status text default 'new',
  created_at timestamptz default now()
);
`;

export interface ApplicationRow { id: string; listing_id: string; student_ref: string; housing_id: unknown; funding: unknown; status: string; created_at: string }
export interface LeadRow { id: string; listing_id: string; budget: number; move_in: string; group_desc: string; guarantor: string; reasons: string[]; status: string }
