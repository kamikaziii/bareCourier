---
status: pending
priority: p1
issue_id: "190"
tags: [security, critical, edge-functions, code-review]
dependencies: []
---

# CRITICAL: Insecure Service Role Detection in send-notification Edge Function

## Problem Statement

The `send-notification` edge function uses substring matching to detect service role authentication, which can be bypassed by an attacker who obtains the first 20 characters of the service key.

**Why it matters:** This is a critical authentication bypass vulnerability that could allow unauthorized users to send notifications to any user, enabling spam, phishing, and social engineering attacks.

## Findings

**File:** `supabase/functions/send-notification/index.ts` (Line 71)

**Vulnerable code:**
```typescript
const isServiceRole = authHeader.includes(supabaseServiceKey.substring(0, 20));
```

**Attack vector:**
```javascript
// If attacker obtains first 20 chars: "eyJhbGciOiJIUzI1NiIs"
// They can forge: "Authorization: Bearer eyJhbGciOiJIUzI1NiIs_FAKE_REST"
// This passes: authHeader.includes(serviceKey.substring(0, 20))
```

**Impact:**
- Unauthorized users can send notifications to any user
- Potential for spam, phishing, and social engineering attacks
- IDOR vulnerabilities if authentication is bypassed

**Source:** Security Sentinel review of PR #8

## Proposed Solutions

### Solution 1: Exact String Comparison with Timing-Safe Function (RECOMMENDED)
**Pros:**
- Cryptographically secure comparison
- Prevents timing attacks
- No performance overhead

**Cons:**
- Requires importing crypto module

**Effort:** Small (30 minutes)

**Risk:** Low - Standard security pattern

**Implementation:**
```typescript
import { timingSafeEqual } from 'node:crypto';

function isServiceRoleKey(authHeader: string, serviceKey: string): boolean {
  const bearerToken = authHeader.replace('Bearer ', '');
  if (bearerToken.length !== serviceKey.length) return false;

  return timingSafeEqual(
    Buffer.from(bearerToken),
    Buffer.from(serviceKey)
  );
}

// Usage:
const isServiceRole = isServiceRoleKey(authHeader, supabaseServiceKey);
```

### Solution 2: Use Dedicated Service Role Header
**Pros:**
- Separates service role auth from user auth
- Clearer authorization model

**Cons:**
- Requires updating all service role callers
- More breaking change

**Effort:** Medium (2 hours)

**Risk:** Medium - Requires coordination with callers

**Implementation:**
```typescript
const serviceRoleKey = req.headers.get('X-Service-Role-Key');
if (serviceRoleKey && timingSafeEqual(Buffer.from(serviceRoleKey), Buffer.from(supabaseServiceKey))) {
  isServiceRole = true;
}
```

### Solution 3: JWT Signature Verification
**Pros:**
- Most robust solution
- Industry standard for API authentication

**Cons:**
- Most complex implementation
- Requires JWT library

**Effort:** Large (4 hours)

**Risk:** Medium - Increased complexity

## Recommended Action

**Solution 1** - Exact string comparison with timing-safe function. It's the simplest fix that eliminates the vulnerability without changing the API contract.

**✅ VERIFIED SAFE:**
- No existing code passes service role key via this endpoint
- All app code uses user access tokens (verified in `notifications.ts:37`)
- Cron jobs call `check-past-due`/`daily-summary` directly (NOT `send-notification`)
- Zero breakage risk - safe to deploy immediately

## Technical Details

**Affected Files:**
- `supabase/functions/send-notification/index.ts`

**Components:**
- Edge Function authentication logic

**Database Changes:** None

## Acceptance Criteria

- [ ] Service role detection uses exact string comparison with constant-time function
- [ ] Authentication cannot be bypassed with partial key match
- [ ] Existing legitimate service role calls continue to work
- [ ] Add unit tests for authentication logic
- [ ] Verify timing attack resistance

## Work Log

### 2026-01-30
- **Discovery:** Security Sentinel agent identified vulnerability during PR #8 review
- **Analysis:** Confirmed substring matching allows bypass with partial key knowledge
- **Priority:** Escalated to P1 (critical) - blocks PR merge

## Resources

- **Related PR:** #8 (feat/navigation-performance-fixes)
- **CWE Reference:** [CWE-287: Improper Authentication](https://cwe.mitre.org/data/definitions/287.html)
- **OWASP:** A07:2021 - Identification and Authentication Failures
- **Edge Function:** `supabase/functions/send-notification/index.ts`
