# Security Question Feature — Deployment Checklist

## What was built

A complete **Password Reset Security Question** feature for EduCampusHub. Users now pick one of 7 security questions during registration and provide an answer. To reset a forgotten password, they answer their security question instead of receiving an OTP.

### Highlights

- **7 questions**: favorite book, childhood nickname, first teacher, favorite movie, favorite place, childhood best friend, favorite color.
- **Answers are bcrypt-hashed** (12 rounds) after normalization (trim + collapse whitespace + lowercase). Plain-text answers are NEVER stored.
- **3-step forgot-password flow**: `verify_email` → `verify_answer` → `reset_password`. Issues a stateless HMAC-signed reset token after the answer is verified.
- **Brute-force protection**: max 5 wrong attempts per email, then 15-minute lockout. Tracked both in-memory AND in the DB (`securityAttempts`, `securityLockedUntil` columns).
- **Privacy**: unknown emails get a fake question so attackers can't enumerate which emails have accounts. Wrong answers always return the same generic message: `"Invalid security answer."` — no hint which field was wrong.
- **Profile page** has a new "Security" tab where users can see their current question and change it (requires current password).
- **Mobile-friendly UI** with progress steps, password-strength meter, lockout countdown, and remaining-attempts warning.

## ⚠️ Before deploying — Run the DB migration

The Prisma schema was updated, but the production Neon DB doesn't have the new columns yet. Run:

```bash
DATABASE_URL="postgresql://USER:PASS@HOST/DB?sslmode=require" npx tsx scripts/migrate-security-question.ts
```

(Replace with your actual Neon connection string — same one Vercel uses.)

The script is **idempotent** (safe to re-run) and uses `IF NOT EXISTS` checks. It adds these 5 columns to the `User` table:

| Column | Type | Notes |
|---|---|---|
| `securityQuestionIdx` | INTEGER | nullable — index 0-6 into SECURITY_QUESTIONS |
| `securityAnswerHash` | TEXT | nullable — bcrypt hash of normalized answer |
| `securityAttempts` | INTEGER NOT NULL DEFAULT 0 | failed-attempt counter |
| `securityLockedUntil` | TIMESTAMP | nullable — lockout expiry |
| `securityUpdatedAt` | TIMESTAMP | nullable — last update time |

## Files changed

**New:**
- `src/lib/security-question.ts` — utility (hashing, validation, brute-force tracking)
- `src/app/api/auth/security-question/route.ts` — GET (view) + POST (set/change) for profile page
- `scripts/migrate-security-question.ts` — DB migration

**Modified:**
- `prisma/schema.prisma` — 5 new fields on User
- `src/app/api/auth/route.ts` — registration now captures security Q&A
- `src/app/api/auth/forgot-password/route.ts` — 3-step security-question flow
- `src/components/campus/LoginPage.tsx` — registration UI + new "Security" step in forgot-password
- `src/components/campus/ProfilePage.tsx` — new Security tab

**Deleted (pre-existing dead code that was blocking the build):**
- `src/middleware.ts` (already replaced by `src/proxy.ts` in a prior task)
- `src/app/api/auth/[...nextauth]/route.ts` (`next-auth` dep was already removed in a prior task)

## API reference

### `POST /api/auth` (register action — extended)
Body now also accepts:
```json
{
  "action": "register",
  "name": "...",
  "email": "...",
  "password": "...",
  "phone": "...",
  "securityQuestionIdx": 0,      // 0-6, REQUIRED
  "securityAnswer": "harry potter" // REQUIRED, will be normalized + hashed
}
```

### `POST /api/auth/forgot-password`
Three actions:

**1. `verify_email`** → returns the user's security question
```json
// Request
{ "action": "verify_email", "email": "user@example.com" }

// Response (known user with security Q set)
{
  "success": true,
  "securityQuestion": "What is your favorite book?",
  "maskedEmail": "user@example.com"
}

// Response (user has no security question set yet)
{
  "success": false,
  "needsSetup": true,
  "message": "No security question is set for this account..."
}

// Response (account locked)
{
  "success": false,
  "locked": true,
  "retryAfterMs": 600000,
  "message": "For security, this account is temporarily locked. Try again in 10 min 0 sec."
}
```

**2. `verify_answer`** → verifies the answer, issues a reset token
```json
// Request
{ "action": "verify_answer", "email": "user@example.com", "securityAnswer": "harry potter" }

// Response (correct)
{
  "success": true,
  "message": "Security answer verified. You can now reset your password.",
  "resetToken": "<HMAC-signed-token>"
}

// Response (wrong answer — generic, never reveals which field failed)
{
  "error": "Invalid security answer.",
  "remainingAttempts": 4
}

// Response (locked)
{
  "error": "Too many incorrect attempts. For security, this account is locked for 15 min 0 sec.",
  "locked": true,
  "retryAfterMs": 900000
}
```

**3. `reset_password`** → uses reset token + new password
```json
{ "action": "reset_password", "email": "...", "resetToken": "...", "newPassword": "..." }
```

### `GET /api/auth/security-question`
Returns the current user's security question (NOT the answer):
```json
{
  "hasSecurityQuestion": true,
  "securityQuestion": "What is your favorite book?",
  "securityQuestionIdx": 0,
  "availableQuestions": ["What is your favorite book?", ...]
}
```

### `POST /api/auth/security-question`
Set or change the security question. Changing requires the current password.
```json
{
  "action": "setup",  // or "update"
  "currentPassword": "current-password",  // required only for "update"
  "securityQuestionIdx": 1,
  "securityAnswer": "nickname-value"
}
```

## Testing checklist

After deploying:

1. **Register a new user** — verify the security question dropdown + answer field appear, and registration fails if either is missing.
2. **Logout, then click "Forgot password"** — enter the user's email → should show their security question → enter wrong answer → should see "Invalid security answer." with attempts remaining → enter correct answer → should reach the reset password screen.
3. **Try 5 wrong answers** — account should be locked for 15 minutes. Wait (or manually clear `securityLockedUntil` in DB) and try again.
4. **Visit Profile → Security tab** — should show current question. Try changing it (requires current password). Try with wrong password — should fail.
5. **Try entering an unregistered email** in forgot-password — should NOT reveal that the email is unregistered (returns a fake question).
