-- =============================================================================
-- bareCourier Demo Data Seed
-- Niche: Dental & Optical Materials Courier
-- Language: Portuguese (Portugal)
-- =============================================================================
-- Uses EXISTING accounts: courier (garridoinformaticasupport@gmail.com)
-- and test client (test@example.com)
-- =============================================================================

DO $$
DECLARE
    v_courier_id UUID;
    v_client_id UUID;  -- The real test@example.com client
    v_client2_id UUID;
    v_client3_id UUID;
    v_client4_id UUID;
    v_service_type_standard UUID;
    v_service_type_express UUID;
    v_service_type_fragile UUID;
    v_today DATE := CURRENT_DATE;
BEGIN
    -- ==========================================================================
    -- GET EXISTING ACCOUNTS
    -- ==========================================================================

    SELECT id INTO v_courier_id FROM auth.users WHERE email = 'garridoinformaticasupport@gmail.com';
    SELECT id INTO v_client_id FROM auth.users WHERE email = 'test@example.com';

    IF v_courier_id IS NULL THEN
        RAISE EXCEPTION 'Courier (garridoinformaticasupport@gmail.com) not found!';
    END IF;

    IF v_client_id IS NULL THEN
        RAISE EXCEPTION 'Test client (test@example.com) not found!';
    END IF;

    -- ==========================================================================
    -- STEP 1: WIPE EXISTING DATA (order matters for FK constraints)
    -- ==========================================================================

    DELETE FROM public.service_reschedule_history;
    DELETE FROM public.service_status_history;
    DELETE FROM public.notifications;
    DELETE FROM public.delivery_time_logs;
    DELETE FROM public.break_logs;
    DELETE FROM public.daily_reviews;
    DELETE FROM public.services;
    DELETE FROM public.pricing_zones;
    DELETE FROM public.client_pricing;
    DELETE FROM public.service_types;
    DELETE FROM public.distribution_zones;
    DELETE FROM public.urgency_fees;
    DELETE FROM public.service_counters;

    -- Delete only demo client profiles (keep courier and test@example.com)
    DELETE FROM public.profiles WHERE role = 'client' AND id != v_client_id;
    DELETE FROM auth.users WHERE email LIKE '%@demo.barecourier.pt';

    -- ==========================================================================
    -- STEP 2: UPDATE COURIER PROFILE
    -- ==========================================================================

    UPDATE public.profiles SET
        name = 'DentalExpress',
        phone = '+351 912 345 678',
        pricing_mode = 'type',
        vat_enabled = true,
        vat_rate = 23,
        prices_include_vat = false,
        show_price_to_courier = true,
        show_price_to_client = true,
        label_business_name = 'DentalExpress',
        label_tagline = 'Transporte especializado de material dentário e ótico',
        timezone = 'Europe/Lisbon',
        locale = 'pt',
        out_of_zone_base = 5.00,
        out_of_zone_per_km = 0.50,
        minimum_charge = 4.00,
        time_specific_price = 2.00,
        time_slots = '{"morning": {"start": "08:00", "end": "12:00"}, "afternoon": {"start": "12:00", "end": "17:00"}, "evening": {"start": "17:00", "end": "20:00"}}'::jsonb,
        working_days = '["monday", "tuesday", "wednesday", "thursday", "friday"]'::jsonb,
        workload_settings = '{"daily_hours": 8, "default_service_time_minutes": 15, "auto_lunch_start": "12:30", "auto_lunch_end": "13:30", "review_time": "18:00", "learning_enabled": true, "learned_service_time_minutes": null, "learning_sample_count": 0}'::jsonb,
        past_due_settings = '{"gracePeriodStandard": 30, "gracePeriodSpecific": 15, "thresholdApproaching": 120, "thresholdUrgent": 60, "thresholdCriticalHours": 24, "allowClientReschedule": true, "clientMinNoticeHours": 2, "clientMaxReschedules": 3, "pastDueReminderInterval": 60, "dailySummaryEnabled": true, "dailySummaryTime": "08:00"}'::jsonb
    WHERE id = v_courier_id;

    -- ==========================================================================
    -- STEP 3: UPDATE TEST CLIENT PROFILE (Laboratório Dental Lisboa)
    -- ==========================================================================

    UPDATE public.profiles SET
        name = 'Laboratório Dental Lisboa',
        phone = '+351 213 456 789',
        default_pickup_location = 'Rua Augusta 45, 1100-048 Lisboa',
        locale = 'pt',
        active = true
    WHERE id = v_client_id;

    -- ==========================================================================
    -- STEP 4: CREATE ADDITIONAL DEMO CLIENTS
    -- (Trigger auto-creates profile from raw_user_meta_data, we just update after)
    -- ==========================================================================

    -- Client 2: Ótica Central Cascais
    v_client2_id := gen_random_uuid();
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
    VALUES (v_client2_id, 'otica.cascais@demo.barecourier.pt', crypt('demo123456', gen_salt('bf')), NOW(),
            '{"name": "Ótica Central Cascais", "role": "client"}'::jsonb);
    UPDATE public.profiles SET
        phone = '+351 214 567 890',
        default_pickup_location = 'Av. Valbom 32, 2750-508 Cascais',
        locale = 'pt'
    WHERE id = v_client2_id;

    -- Client 3: Clínica Dentária Almada
    v_client3_id := gen_random_uuid();
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
    VALUES (v_client3_id, 'clinica.almada@demo.barecourier.pt', crypt('demo123456', gen_salt('bf')), NOW(),
            '{"name": "Clínica Dentária Almada", "role": "client"}'::jsonb);
    UPDATE public.profiles SET
        phone = '+351 212 345 678',
        default_pickup_location = 'Praça da Liberdade 15, 2800-180 Almada',
        locale = 'pt'
    WHERE id = v_client3_id;

    -- Client 4: Laboratório de Lentes Oeiras
    v_client4_id := gen_random_uuid();
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data)
    VALUES (v_client4_id, 'lablentes.oeiras@demo.barecourier.pt', crypt('demo123456', gen_salt('bf')), NOW(),
            '{"name": "Laboratório de Lentes Oeiras", "role": "client"}'::jsonb);
    UPDATE public.profiles SET
        phone = '+351 214 789 012',
        default_pickup_location = 'Rua das Flores 88, 2780-271 Oeiras',
        locale = 'pt'
    WHERE id = v_client4_id;

    -- ==========================================================================
    -- STEP 5: CREATE SERVICE TYPES
    -- ==========================================================================

    INSERT INTO public.service_types (id, name, description, price, sort_order, active) VALUES
        (gen_random_uuid(), 'Entrega Standard', 'Entrega normal de material dentário ou ótico', 5.00, 1, true),
        (gen_random_uuid(), 'Entrega Expresso', 'Entrega urgente no mesmo dia', 10.00, 2, true),
        (gen_random_uuid(), 'Material Frágil', 'Próteses, moldes e lentes com manuseio especial', 8.00, 3, true);

    SELECT id INTO v_service_type_standard FROM public.service_types WHERE name = 'Entrega Standard';
    SELECT id INTO v_service_type_express FROM public.service_types WHERE name = 'Entrega Expresso';
    SELECT id INTO v_service_type_fragile FROM public.service_types WHERE name = 'Material Frágil';

    -- Update test client with default service type
    UPDATE public.profiles SET default_service_type_id = v_service_type_fragile WHERE id = v_client_id;

    -- ==========================================================================
    -- STEP 6: CREATE DISTRIBUTION ZONES
    -- ==========================================================================

    INSERT INTO public.distribution_zones (distrito, concelho) VALUES
        ('Lisboa', 'Lisboa'), ('Lisboa', 'Amadora'), ('Lisboa', 'Oeiras'),
        ('Lisboa', 'Cascais'), ('Lisboa', 'Sintra'), ('Lisboa', 'Loures'),
        ('Lisboa', 'Odivelas'), ('Setúbal', 'Almada'), ('Setúbal', 'Seixal');

    -- ==========================================================================
    -- STEP 7: CREATE URGENCY FEES
    -- ==========================================================================

    INSERT INTO public.urgency_fees (name, description, flat_fee, multiplier, sort_order, active) VALUES
        ('Normal', 'Sem taxa de urgência', 0, 1.0, 1, true),
        ('Urgente', 'Entrega prioritária (+50%)', 0, 1.5, 2, true),
        ('Crítico', 'Entrega imediata (+100%)', 5.00, 2.0, 3, true);

    -- ==========================================================================
    -- STEP 8: RESET SERVICE COUNTER
    -- ==========================================================================

    INSERT INTO public.service_counters (year, last_number)
    VALUES (EXTRACT(YEAR FROM CURRENT_DATE)::int, 0)
    ON CONFLICT (year) DO UPDATE SET last_number = 0;

    -- ==========================================================================
    -- STEP 9: CREATE SERVICES
    -- ==========================================================================

    -- TODAY: 3 pending (for test client - so client dashboard shows data)
    INSERT INTO public.services (
        client_id, pickup_location, delivery_location, status, request_status,
        scheduled_date, scheduled_time_slot, service_type_id, notes,
        pickup_lat, pickup_lng, delivery_lat, delivery_lng, distance_km,
        calculated_price, duration_minutes, display_id,
        recipient_name, recipient_phone, customer_reference,
        price_breakdown, vat_rate_snapshot, prices_include_vat_snapshot
    ) VALUES
    (v_client_id, 'Rua Augusta 45, 1100-048 Lisboa',
     'Clínica Dental Smile, Av. da República 25, 1050-185 Lisboa',
     'pending', 'accepted', v_today, 'morning', v_service_type_fragile,
     'Prótese dentária completa superior - FRÁGIL',
     38.7103, -9.1365, 38.7340, -9.1466, 3.2, 8.00, 25, '#26-0001',
     'Dr. António Silva', '+351 961 234 567', 'PO-2026-0142',
     '{"base": 8.00, "total": 8.00, "model": "type", "service_type_name": "Material Frágil"}'::jsonb, 23, false),

    (v_client_id, 'Rua Augusta 45, 1100-048 Lisboa',
     'Centro Médico Dentário, Av. Fontes Pereira de Melo 35, Lisboa',
     'pending', 'accepted', v_today, 'afternoon', v_service_type_express,
     'Moldes para coroas cerâmicas x3 - URGENTE',
     38.7103, -9.1365, 38.7297, -9.1481, 4.1, 10.00, 20, '#26-0002',
     'Dra. Ana Ferreira', '+351 967 234 567', 'MOL-2026-0089',
     '{"base": 10.00, "total": 10.00, "model": "type", "service_type_name": "Entrega Expresso"}'::jsonb, 23, false),

    (v_client2_id, 'Av. Valbom 32, 2750-508 Cascais',
     'Ótica Visão Clara, Centro Comercial Colombo, Lisboa',
     'pending', 'accepted', v_today, 'morning', v_service_type_standard,
     'Par de lentes progressivas personalizadas',
     38.6979, -9.4215, 38.7537, -9.1890, 12.5, 5.00, 35, '#26-0003',
     'Ótica Visão Clara', '+351 217 890 123', 'LP-4521',
     '{"base": 5.00, "total": 5.00, "model": "type"}'::jsonb, 23, false);

    -- YESTERDAY: 4 delivered (for billing/reports)
    INSERT INTO public.services (
        client_id, pickup_location, delivery_location, status, request_status,
        scheduled_date, scheduled_time_slot, service_type_id, notes, distance_km,
        calculated_price, duration_minutes, display_id, delivered_at, recipient_name,
        price_breakdown, vat_rate_snapshot, prices_include_vat_snapshot
    ) VALUES
    (v_client_id, 'Rua Augusta 45, Lisboa', 'Av. Almirante Reis 70, Lisboa',
     'delivered', 'accepted', v_today - 1, 'morning', v_service_type_fragile,
     'Prótese parcial removível inferior', 1.8, 8.00, 20, '#26-0004',
     (v_today - 1 + TIME '10:45:00')::timestamp, 'Dra. Maria Santos',
     '{"base": 8.00, "total": 8.00, "model": "type"}'::jsonb, 23, false),

    (v_client2_id, 'Av. Valbom 32, Cascais', 'Alameda Linhas de Torres, Lisboa',
     'delivered', 'accepted', v_today - 1, 'afternoon', v_service_type_standard,
     'Armações Ray-Ban (6 unidades) + Lentes Zeiss', 28.5, 5.00, 45, '#26-0005',
     (v_today - 1 + TIME '14:30:00')::timestamp, 'Ótica Lumiar',
     '{"base": 5.00, "total": 5.00, "model": "type"}'::jsonb, 23, false),

    (v_client3_id, 'Praça da Liberdade 15, Almada', 'Av. da Liberdade 180, Lisboa',
     'delivered', 'accepted', v_today - 1, 'morning', v_service_type_fragile,
     'Implantes dentários cerâmicos (kit completo)', 8.2, 8.00, 30, '#26-0006',
     (v_today - 1 + TIME '11:15:00')::timestamp, 'Dr. João Martins',
     '{"base": 8.00, "total": 8.00, "model": "type"}'::jsonb, 23, false),

    (v_client_id, 'Rua Augusta 45, Lisboa', 'Rua Garrett 83, Lisboa',
     'delivered', 'accepted', v_today - 1, 'afternoon', v_service_type_express,
     'Goteira oclusal - entrega urgente', 0.8, 10.00, 15, '#26-0007',
     (v_today - 1 + TIME '16:00:00')::timestamp, 'Clínica Dental Chiado',
     '{"base": 10.00, "total": 10.00, "model": "type"}'::jsonb, 23, false);

    -- TOMORROW: 2 scheduled
    INSERT INTO public.services (
        client_id, pickup_location, delivery_location, status, request_status,
        scheduled_date, scheduled_time_slot, service_type_id, notes, distance_km,
        calculated_price, duration_minutes, display_id, recipient_name, recipient_phone,
        price_breakdown, vat_rate_snapshot, prices_include_vat_snapshot
    ) VALUES
    (v_client_id, 'Rua Augusta 45, Lisboa', 'Parque das Nações, Passeio Tágides 14, Lisboa',
     'pending', 'accepted', v_today + 1, 'morning', v_service_type_fragile,
     'Facetas de porcelana (8 unidades) - FRÁGIL', 6.8, 8.00, 25, '#26-0008',
     'Dr. Rui Carvalho', '+351 969 345 678',
     '{"base": 8.00, "total": 8.00, "model": "type"}'::jsonb, 23, false),

    (v_client4_id, 'Rua das Flores 88, Oeiras', 'Av. Torre de Belém 38, Lisboa',
     'pending', 'accepted', v_today + 1, 'afternoon', v_service_type_standard,
     'Lentes intraoculares para cirurgia', 12.1, 5.00, 30, '#26-0009',
     'Clínica Oftalmológica', '+351 213 012 345',
     '{"base": 5.00, "total": 5.00, "model": "type"}'::jsonb, 23, false);

    -- PENDING REQUEST: For courier requests page
    INSERT INTO public.services (
        client_id, pickup_location, delivery_location, status, request_status,
        requested_date, requested_time_slot, service_type_id, notes, distance_km,
        calculated_price, display_id, recipient_name, recipient_phone,
        price_breakdown, vat_rate_snapshot, prices_include_vat_snapshot
    ) VALUES
    (v_client_id, 'Rua Augusta 45, Lisboa', 'Rua Braamcamp 40, Lisboa',
     'pending', 'pending', v_today + 2, 'morning', v_service_type_fragile,
     'Coroas de zircónia (4 unidades) - Aguarda confirmação', 2.5, 8.00, '#26-0010',
     'Clínica Dental Saldanha', '+351 968 567 890',
     '{"base": 8.00, "total": 8.00, "model": "type"}'::jsonb, 23, false);

    -- SUGGESTED: Client needs to respond (for client "needs attention")
    INSERT INTO public.services (
        client_id, pickup_location, delivery_location, status, request_status,
        requested_date, requested_time_slot, suggested_date, suggested_time_slot,
        service_type_id, notes, distance_km, calculated_price, display_id,
        recipient_name, price_breakdown, vat_rate_snapshot, prices_include_vat_snapshot
    ) VALUES
    (v_client_id, 'Rua Augusta 45, Lisboa', 'Av. Duque de Ávila 120, Lisboa',
     'pending', 'suggested', v_today + 1, 'morning', v_today + 2, 'afternoon',
     v_service_type_express, 'Prótese provisória', 2.8, 10.00, '#26-0011',
     'Centro Dental',
     '{"base": 10.00, "total": 10.00, "model": "type"}'::jsonb, 23, false);

    -- PAST WEEK: More delivered for billing variety
    INSERT INTO public.services (
        client_id, pickup_location, delivery_location, status, request_status,
        scheduled_date, scheduled_time_slot, service_type_id, notes, distance_km,
        calculated_price, display_id, delivered_at, recipient_name,
        price_breakdown, vat_rate_snapshot, prices_include_vat_snapshot
    ) VALUES
    (v_client_id, 'Rua Augusta 45, Lisboa', 'Av. Roma 78, Lisboa',
     'delivered', 'accepted', v_today - 3, 'morning', v_service_type_fragile,
     'Prótese fixa sobre implantes', 4.2, 8.00, '#26-0012',
     (v_today - 3 + TIME '09:30:00')::timestamp, 'Dr. Pedro Lopes',
     '{"base": 8.00, "total": 8.00, "model": "type"}'::jsonb, 23, false),

    (v_client2_id, 'Av. Valbom 32, Cascais', 'Rua Castilho 50, Lisboa',
     'delivered', 'accepted', v_today - 3, 'afternoon', v_service_type_standard,
     'Óculos graduados (3 pares)', 25.0, 5.00, '#26-0013',
     (v_today - 3 + TIME '15:00:00')::timestamp, 'Ótica Elegância',
     '{"base": 5.00, "total": 5.00, "model": "type"}'::jsonb, 23, false),

    (v_client3_id, 'Praça da Liberdade 15, Almada', 'Av. Defensores de Chaves, Lisboa',
     'delivered', 'accepted', v_today - 4, 'morning', v_service_type_express,
     'Moldes para aparelho ortodôntico', 9.5, 10.00, '#26-0014',
     (v_today - 4 + TIME '10:15:00')::timestamp, 'Clínica Ortodontia',
     '{"base": 10.00, "total": 10.00, "model": "type"}'::jsonb, 23, false),

    (v_client_id, 'Rua Augusta 45, Lisboa', 'Alameda D. Afonso Henriques 40, Lisboa',
     'delivered', 'accepted', v_today - 5, 'afternoon', v_service_type_express,
     'Prótese provisória urgente', 2.5, 10.00, '#26-0015',
     (v_today - 5 + TIME '16:30:00')::timestamp, 'Centro Dental Alameda',
     '{"base": 10.00, "total": 10.00, "model": "type"}'::jsonb, 23, false);

    -- ==========================================================================
    -- STEP 10: CREATE NOTIFICATIONS
    -- ==========================================================================

    -- Notification for courier: new pending request
    INSERT INTO public.notifications (user_id, type, title, message, read, service_id)
    SELECT v_courier_id, 'new_request', 'Novo pedido de serviço',
           'Laboratório Dental Lisboa solicitou uma nova entrega', false, id
    FROM public.services WHERE display_id = '#26-0010';

    -- Notification for client: suggestion pending
    INSERT INTO public.notifications (user_id, type, title, message, read, service_id)
    SELECT v_client_id, 'schedule_change', 'Nova sugestão de data',
           'O estafeta sugeriu uma nova data para a sua entrega', false, id
    FROM public.services WHERE display_id = '#26-0011';

    -- Old read notification
    INSERT INTO public.notifications (user_id, type, title, message, read, created_at)
    VALUES (v_courier_id, 'daily_summary', 'Resumo do dia',
            'Ontem completou 4 entregas. Faturação: €31,00', true, NOW() - INTERVAL '1 day');

    RAISE NOTICE '✅ Demo data seeded successfully!';
    RAISE NOTICE 'Courier: DentalExpress (garridoinformaticasupport@gmail.com)';
    RAISE NOTICE 'Test Client: Laboratório Dental Lisboa (test@example.com)';
    RAISE NOTICE 'Created: 15 services, 3 service types, 9 zones, 3 urgency fees';

END $$;
