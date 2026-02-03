# bareCourier - Project Overview

## Purpose
bareCourier is a PWA (Progressive Web App) for a solo courier to manage pickups and deliveries, replacing paper-based tracking. It's a simple, mobile-first application with two user roles.

## User Roles
- **Courier** (admin): Manages all services, clients, reports, and system settings
- **Client** (businesses): Can create service requests and view their own services

## Key Features
- Service management (pickup/delivery jobs)
- Client management
- Route visualization with Mapbox
- Distance calculation (OpenRouteService API)
- Monthly reports with CSV export
- Real-time notifications
- PWA with offline support

## Deployment
- Hosted on **Vercel** with adapter-vercel
- Backend on **Supabase** (PostgreSQL with RLS)
