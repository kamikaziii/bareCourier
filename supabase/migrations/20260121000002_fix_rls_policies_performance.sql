-- Fix RLS policies to use (select auth.uid()) for better performance
-- This prevents re-evaluation of auth.uid() for each row

-- Drop existing policies
DROP POLICY IF EXISTS "Courier can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can read own profile" ON profiles;
DROP POLICY IF EXISTS "Courier can insert profiles" ON profiles;
DROP POLICY IF EXISTS "Courier can update all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Courier can read all services" ON services;
DROP POLICY IF EXISTS "Clients can read own services" ON services;
DROP POLICY IF EXISTS "Courier can insert services" ON services;
DROP POLICY IF EXISTS "Clients can insert own services" ON services;
DROP POLICY IF EXISTS "Courier can update services" ON services;

-- Recreate profiles policies with optimized auth.uid() calls
-- Combine read policies into one with OR condition to avoid multiple permissive policies
CREATE POLICY "profiles_select" ON profiles
  FOR SELECT USING (
    id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (select auth.uid()) AND p.role = 'courier'
    )
  );

-- Only courier can insert profiles (creating clients)
CREATE POLICY "profiles_insert" ON profiles
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (select auth.uid()) AND p.role = 'courier'
    )
  );

-- Combine update policies: courier can update all, users can update own
CREATE POLICY "profiles_update" ON profiles
  FOR UPDATE USING (
    id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (select auth.uid()) AND p.role = 'courier'
    )
  );

-- Recreate services policies with optimized auth.uid() calls
-- Combine read policies into one
CREATE POLICY "services_select" ON services
  FOR SELECT USING (
    client_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (select auth.uid()) AND p.role = 'courier'
    )
  );

-- Combine insert policies: courier can insert any, clients can insert own
CREATE POLICY "services_insert" ON services
  FOR INSERT WITH CHECK (
    client_id = (select auth.uid())
    OR EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (select auth.uid()) AND p.role = 'courier'
    )
  );

-- Only courier can update services
CREATE POLICY "services_update" ON services
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (select auth.uid()) AND p.role = 'courier'
    )
  );
