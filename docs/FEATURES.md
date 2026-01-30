# bareCourier Features

Complete feature inventory for bareCourier - a PWA for solo courier management.

---

## Core Features

### Authentication
| Feature | Description | Roles |
|---------|-------------|-------|
| Email/Password Login | Sign in with email and password | Both |
| Role-Based Routing | Automatic redirect to courier or client dashboard based on role | Both |
| Session Management | Persistent sessions with Supabase Auth | Both |

### Service Management

#### Courier Features
| Feature | Description | Status |
|---------|-------------|--------|
| Services List | Browse all services with filters by status, client, and date range | ✅ |
| Service Search | Search services by notes, locations, and display ID | ✅ |
| Create Service | Create pickup/delivery with addresses, schedule, pricing, recipient | ✅ |
| Edit Service | Modify service details including addresses and pricing | ✅ |
| Service Details | Full view with locations, schedule, pricing breakdown, status history | ✅ |
| Mark Delivered | Toggle service status between pending and delivered | ✅ |
| Batch Selection | Select multiple services for bulk actions | ✅ |
| Batch Reschedule | Reschedule multiple services at once with notifications | ✅ |
| CSV Export | Export filtered services to CSV | ✅ |
| Pagination | Paginated service list for large datasets | ✅ |

#### Client Features
| Feature | Description | Status |
|---------|-------------|--------|
| Service Requests | Submit pickup/delivery requests with optional scheduling | ✅ |
| Edit Pending Requests | Modify pending requests before acceptance | ✅ |
| Cancel Requests | Cancel pending service requests | ✅ |
| View Service Details | See service status, locations, and pricing | ✅ |
| Request Reschedule | Request to change scheduled date/time | ✅ |
| Respond to Suggestions | Accept or decline courier counter-proposals | ✅ |
| Batch Accept/Decline | Process multiple suggestions at once | ✅ |
| Needs Attention Section | Dashboard highlights requiring action | ✅ |

### Service Identification
| Feature | Description | Status |
|---------|-------------|--------|
| Display IDs | Human-readable #YY-NNNN format IDs | ✅ |
| Copy to Clipboard | One-click copy of display IDs | ✅ |
| Customer Reference | Client's own PO/invoice numbers | ✅ |
| Recipient Tracking | Separate recipient name and phone from ordering client | ✅ |

### Printable Labels
| Feature | Description | Status |
|---------|-------------|--------|
| Print Label Dialog | Generate shipping labels from service detail | ✅ |
| QR Code Generation | QR codes linking to tracking page | ✅ |
| Label Branding | Customizable business name and tagline | ✅ |
| QR Tracking Redirect | Public tracking page via QR scan | ✅ |

---

## Scheduling

### Calendar Views
| Feature | Description | Roles | Status |
|---------|-------------|-------|--------|
| Courier Calendar | Interactive calendar with day-by-day detail panel | Courier | ✅ |
| Client Calendar | Read-only calendar view of scheduled services | Client | ✅ |

### Scheduling Workflow
| Feature | Description | Status |
|---------|-------------|--------|
| Requested Date/Time | Client can request specific date and time slot | ✅ |
| Time Slots | Morning, afternoon, evening, or specific time | ✅ |
| Accept/Reject/Suggest | Courier responds to requests with options | ✅ |
| Courier Reschedule | Reschedule with optional client approval | ✅ |
| Client Approval Flow | Client accepts or declines suggested times | ✅ |
| Scheduling Info Display | Show scheduling status on service views | ✅ |

### Service Requests Management
| Feature | Description | Status |
|---------|-------------|--------|
| Requests Page | Dedicated page for pending requests | ✅ |
| Workload Display | Show courier availability when reviewing requests | ✅ |
| Approve Reschedules | Handle client-initiated reschedule requests | ✅ |

---

## Clients

| Feature | Description | Status |
|---------|-------------|--------|
| Clients List | View all active and inactive clients | ✅ |
| Create Client | Add new client with contact info and default location | ✅ |
| Client Details | View client info, services, stats, pricing config | ✅ |
| Edit Client | Update client details and pricing configuration | ✅ |
| Deactivate Client | Soft-deactivate clients (preserves history) | ✅ |
| Default Pickup Location | Pre-fill pickup address for client requests | ✅ |

---

## Pricing

### Type-Based Pricing System
| Feature | Description | Status |
|---------|-------------|--------|
| Service Types | Categorize services by type for pricing | ✅ |
| Base Price + Distance | Price calculation with base fee and per-km rate | ✅ |
| Zone Detection | Automatic zone detection for pricing tiers | ✅ |
| Zone Override | Manual override of automatic zone detection | ✅ |
| Urgency Fees | Additional fees for urgent deliveries | ✅ |
| Price Breakdown Display | Detailed breakdown on service detail pages | ✅ |
| Live Price Preview | Real-time price calculation while entering details | ✅ |

### Client Pricing
| Feature | Description | Status |
|---------|-------------|--------|
| Per-Client Configuration | Custom pricing per client | ✅ |
| Client Price Estimate | Show estimate when client creates request | ✅ |
| Pricing from Multiple Entry Points | Access pricing from client form, detail, billing | ✅ |

### VAT Support
| Feature | Description | Status |
|---------|-------------|--------|
| VAT Rate Configuration | Set VAT percentage | ✅ |
| VAT Inclusive/Exclusive | Toggle whether prices include VAT | ✅ |
| VAT in Billing | Display VAT in billing summaries | ✅ |

---

## Billing & Reports

### Courier Billing
| Feature | Description | Status |
|---------|-------------|--------|
| Billing Summary | View billing by client with totals | ✅ |
| Client Billing Detail | Drill into specific client billing | ✅ |
| Distance Tracking | Track total km per client | ✅ |
| Revenue Display | Show revenue per client | ✅ |
| Pagination | Handle large billing datasets | ✅ |

### Client Billing
| Feature | Description | Status |
|---------|-------------|--------|
| View Pricing Config | See applied pricing rules | ✅ |
| Service Costs | View costs per service | ✅ |
| CSV Export | Export billing data | ✅ |
| Pagination | Handle many transactions | ✅ |

### Insights
| Feature | Description | Status |
|---------|-------------|--------|
| Insights Dashboard | Business analytics with overview and charts | ✅ |
| Data Export | Export analytics data | ✅ |

---

## Notifications

| Feature | Description | Status |
|---------|-------------|--------|
| Notification Bell | Real-time notification dropdown | ✅ |
| Dismiss Notifications | Mark notifications as read | ✅ |
| Multi-Channel Support | In-app, push, and email channels | ✅ |
| Granular Preferences | Per-category and per-channel settings | ✅ |
| Client Notification Parity | Full feature parity for clients | ✅ |

---

## Workload Management

| Feature | Description | Status |
|---------|-------------|--------|
| Workload Estimate | Today's driving time, service time estimate | ✅ |
| Trip Duration Storage | Save trip time when creating services | ✅ |
| Trip Time Display | Show stored trip duration on location cards | ✅ |
| Capacity Indicator | Visual indicator if workload fits working hours | ✅ |

### Urgency System
| Feature | Description | Status |
|---------|-------------|--------|
| Past Due Detection | Identify overdue service requests | ✅ |
| Urgency Badges | Color-coded urgency indicators | ✅ |
| Urgency Sorting | Sort services by urgency level | ✅ |
| Configurable Thresholds | Customize past due timing | ✅ |

---

## Settings

### Courier Settings
| Feature | Description | Status |
|---------|-------------|--------|
| Account Settings | Profile and contact info | ✅ |
| Pricing Settings | Global pricing configuration | ✅ |
| Scheduling Settings | Time slots, working hours | ✅ |
| Notification Preferences | Channel and category settings | ✅ |
| Service Types | Configure available service types | ✅ |
| Distribution Zones | Define delivery zones | ✅ |
| Label Branding | Customize printed labels | ✅ |

### Client Settings
| Feature | Description | Status |
|---------|-------------|--------|
| Profile Settings | Name and contact info | ✅ |
| Default Pickup Location | Set default address | ✅ |
| Notification Preferences | Email and push settings | ✅ |

---

## UI/UX

### Navigation
| Feature | Description | Status |
|---------|-------------|--------|
| Mobile Bottom Nav | Touch-friendly bottom navigation | ✅ |
| Desktop Sidebar | Full navigation sidebar | ✅ |
| More Drawer | Additional options in mobile nav | ✅ |

### Components
| Feature | Description | Status |
|---------|-------------|--------|
| Address Autocomplete | Mapbox geocoding input | ✅ |
| Route Map | Mapbox map with pickup/delivery display | ✅ |
| Schedule Picker | Date picker + time slot selector | ✅ |
| Pagination Controls | Shared pagination component | ✅ |
| Empty States | Consistent empty list displays | ✅ |
| Loading Skeletons | Loading state indicators | ✅ |
| Reschedule Dialog | Streamlined rescheduling interface | ✅ |

### Internationalization
| Feature | Description | Status |
|---------|-------------|--------|
| Full i18n | Complete translation support | ✅ |
| Locale Sync | Synced locale preferences | ✅ |
| Email Translations | Translated email templates | ✅ |

### PWA
| Feature | Description | Status |
|---------|-------------|--------|
| Installable | Add to Home Screen support | ✅ |
| Offline Caching | Service worker with Supabase caching | ✅ |
| App Shortcuts | Quick actions from home screen | ✅ |

---

## Planned Features

### Admin Panel
| Feature | Description | Status |
|---------|-------------|--------|
| Admin Role | Super admin with elevated permissions | 📋 Planned |
| User Impersonation | Reproduce bugs by viewing as user | 📋 Planned |
| Activity Dashboard | Today's stats, activity feed, anomaly alerts | 📋 Planned |
| Users Browser | Searchable/filterable user table | 📋 Planned |
| Services Browser | Admin-level service search and filtering | 📋 Planned |
| Service Editor | Direct service editing with audit log | 📋 Planned |
| Audit Log Viewer | Browse all admin actions with diffs | 📋 Planned |
| Feature Flags | Toggle features system-wide | 📋 Planned |

### Future Enhancements
| Feature | Description | Status |
|---------|-------------|--------|
| Quiet Hours | Schedule notification-free periods | 📋 Planned |
| Break Tracking | Track work breaks with auto-prompts | 📋 Planned |
| Mini Status Bar | Mobile work state indicator | 📋 Planned |

---

## Feature Parity Notes

Areas where client has fewer features than courier (by design or pending):

| Gap | Courier Has | Client Has |
|-----|-------------|------------|
| Service Filtering | Full filters | Basic status only |
| Insights/Analytics | Full dashboard | None |
| Service Creation | Full control | Request only |

---

*Last updated: 2025-01-30*
*Generated from: routes, git history (67 feat commits), planning docs*
