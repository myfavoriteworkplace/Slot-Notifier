# Clinic Login Debug

## Findings
- Database check for username `smile_1` returned no results.
- Only one clinic exists in the database: `Demo Smile Clinic` with username `demo_clinic`.
- The user is attempting to login with `smile_1` which does not exist in the system.

## Resolution
- The 401 error is correct because the user doesn't exist.
- User should use `demo_clinic` / `demo_password123` for the demo clinic or create a new clinic via the Admin panel.
- Also noticed the curl request is hitting `/api/auth/clinic/login` but the server routes might be slightly different depending on which file is running (`server/routes.ts` vs `server/standalone.ts`).

## Database State
```
id,name,username,is_archived
1,Demo Smile Clinic,demo_clinic,f
```
