# send-email Edge Function

Sends email notifications via Resend API with automatic retry for transient failures.

## Endpoint

```
POST /functions/v1/send-email
```

## Authentication

| Method | Header | Use Case |
|--------|--------|----------|
| Service Role | `Authorization: Bearer <service_role_key>` | Internal calls from notify.ts |
| User JWT | `Authorization: Bearer <user_jwt>` | Direct calls from frontend |

## Request

```json
{
  "user_id": "uuid - target user",
  "template": "new_request | delivered | request_accepted | ...",
  "data": {
    "pickup_location": "string",
    "delivery_location": "string",
    "app_url": "string",
    "...template-specific fields"
  }
}
```

## Templates

| Template | Required Fields | Recipient |
|----------|-----------------|-----------|
| new_request | client_name, pickup_location, delivery_location, app_url | Courier |
| delivered | pickup_location, delivery_location, delivered_at, app_url | Client |
| request_accepted | pickup_location, delivery_location, app_url | Client |
| request_rejected | pickup_location, delivery_location, app_url | Client |
| request_suggested | pickup_location, delivery_location, requested_date, suggested_date, app_url | Client |
| request_cancelled | client_name, pickup_location, delivery_location, app_url | Courier |

## Response

### Success
```json
{
  "success": true,
  "sent": true,
  "email_id": "resend-message-id"
}
```

### Skipped (notifications disabled)
```json
{
  "success": true,
  "sent": false,
  "reason": "Email notifications disabled for user"
}
```

### Error
```json
{
  "success": false,
  "error": {
    "code": "API_ERROR",
    "message": "Failed to send email",
    "retryable": true,
    "retryAfterMs": 60000
  }
}
```

### Error Codes

| Code | HTTP | Retryable | Description |
|------|------|-----------|-------------|
| `CONFIG_ERROR` | 500 | No | Email service not configured |
| `AUTH_ERROR` | 401 | No | Missing or invalid authorization |
| `VALIDATION_ERROR` | 400 | No | Missing required fields |
| `USER_NOT_FOUND` | 404 | No | Target user email not found |
| `FORBIDDEN` | 403 | No | IDOR protection - cannot email other users |
| `NOTIFICATIONS_DISABLED` | 200 | No | User has disabled email notifications |
| `RATE_LIMIT` | 429 | Yes | Resend rate limit exceeded |
| `QUOTA_EXCEEDED` | 429 | No | Daily/monthly quota exceeded |
| `API_ERROR` | 500 | Maybe | Resend API error (5xx retryable, 4xx not) |
| `TIMEOUT_ERROR` | 504 | Yes | Request or function timeout |
| `INTERNAL_ERROR` | 500 | No | Unexpected server error |

## Retry Behavior

- **Retries on:** 429 rate_limit_exceeded, 5xx errors, timeouts
- **Fails fast on:** 429 quota_exceeded, 4xx client errors
- **Max retries:** 3 (4 total attempts)
- **Backoff:** Exponential with jitter (500ms base)
- **Timeout guard:** Aborts if approaching 55s function limit
