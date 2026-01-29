-- Drop old duplicate policies that weren't dropped in previous migration
DROP POLICY IF EXISTS "Courier can create profiles" ON profiles;
DROP POLICY IF EXISTS "Courier can update profiles" ON profiles;
DROP POLICY IF EXISTS "Clients can create own services" ON services;
DROP POLICY IF EXISTS "Courier can create services" ON services;
