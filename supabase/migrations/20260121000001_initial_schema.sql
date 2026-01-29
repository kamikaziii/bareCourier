-- bareCourier Database Schema
-- Initial migration for profiles and services tables

-- Enable RLS
alter default privileges revoke execute on functions from public;

-- Profiles table (extends Supabase auth.users)
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  role text not null check (role in ('courier', 'client')),
  name text not null,
  phone text,
  default_pickup_location text,
  active boolean default true,
  created_at timestamptz default now()
);

-- Services table (pickup/delivery jobs)
create table public.services (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.profiles(id) on delete cascade not null,
  pickup_location text not null,
  delivery_location text not null,
  status text not null default 'pending' check (status in ('pending', 'delivered')),
  notes text,
  created_at timestamptz default now(),
  delivered_at timestamptz
);

-- Enable Row Level Security
alter table public.profiles enable row level security;
alter table public.services enable row level security;

-- RLS Policies for Profiles

-- Courier can read all profiles
create policy "Courier can read all profiles"
  on public.profiles
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'courier'
    )
  );

-- Users can read their own profile
create policy "Users can read own profile"
  on public.profiles
  for select
  to authenticated
  using (id = auth.uid());

-- Courier can create profiles (for adding clients)
create policy "Courier can create profiles"
  on public.profiles
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'courier'
    )
  );

-- Courier can update any profile
create policy "Courier can update profiles"
  on public.profiles
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'courier'
    )
  );

-- Users can update their own profile
create policy "Users can update own profile"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid());

-- RLS Policies for Services

-- Courier can read all services
create policy "Courier can read all services"
  on public.services
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'courier'
    )
  );

-- Clients can read their own services
create policy "Clients can read own services"
  on public.services
  for select
  to authenticated
  using (client_id = auth.uid());

-- Clients can create services for themselves
create policy "Clients can create own services"
  on public.services
  for insert
  to authenticated
  with check (client_id = auth.uid());

-- Courier can create services for any client
create policy "Courier can create services"
  on public.services
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'courier'
    )
  );

-- Courier can update any service
create policy "Courier can update services"
  on public.services
  for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'courier'
    )
  );

-- Create indexes for better query performance
create index idx_services_client_id on public.services(client_id);
create index idx_services_status on public.services(status);
create index idx_services_created_at on public.services(created_at);
create index idx_profiles_role on public.profiles(role);

-- Function to automatically create profile after signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, role, name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'client'),
    coalesce(new.raw_user_meta_data->>'name', new.email)
  );
  return new;
end;
$$;

-- Trigger to create profile on signup
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
