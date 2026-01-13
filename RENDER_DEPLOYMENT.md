# Render.com Deployment Guide

This guide explains how to deploy BookMySlot on Render.com with separate frontend and backend services.

## Architecture Overview

- **Frontend**: Static site (React/Vite) - FREE on Render
- **Backend**: Web service (Node.js/Express) - ~$7/month after free tier
- **Database**: PostgreSQL - ~$7/month after free tier

## Prerequisites

1. A Render.com account
2. Your code pushed to a GitHub repository

## Step 1: Create PostgreSQL Database

1. Go to Render Dashboard > New > PostgreSQL
2. Choose a name (e.g., `bookmyslot-db`)
3. Select the free tier or paid plan
4. Click "Create Database"
5. Copy the "External Database URL" for later use

## Step 2: Deploy Backend Service

### Build Commands
In your Render web service settings:

- **Build Command**: 
```
npm install && npm run db:push && tsx script/build-standalone.ts
```

- **Start Command**: 
```
node dist-backend/server.cjs
```

### Environment Variables

Set these environment variables in Render:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | (paste from Step 1) |
| `SESSION_SECRET` | (generate a random 32+ character string) |
| `NODE_ENV` | `production` |
| `PORT` | `10000` |
| `FRONTEND_URL` | Your frontend URL (e.g., `https://bookmyslot-frontend.onrender.com`) |
| `ADMIN_EMAIL` | `itsmyfavoriteworkplace@gmail.com` (or your admin email) |
| `ADMIN_PASSWORD` | (set a secure password for admin login) |

### Important Notes

- The backend uses a simple email/password login for admin access (since Replit auth doesn't work on Render)
- Clinic logins work the same way using username/password

## Step 3: Deploy Frontend (Static Site)

1. Go to Render Dashboard > New > Static Site
2. Connect your GitHub repository
3. Configure:
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist/client`

### Environment Variables for Frontend

| Variable | Value |
|----------|-------|
| `VITE_API_URL` | Your backend URL (e.g., `https://bookmyslot-api.onrender.com`) |

## Step 4: Configure CORS

Make sure your backend's `FRONTEND_URL` environment variable matches your frontend's actual URL. This enables cross-origin requests.

## Admin Login

On Render, the admin login works differently than on Replit:

1. Go to `/login` on your deployed frontend
2. Use the email and password you set in `ADMIN_EMAIL` and `ADMIN_PASSWORD` environment variables
3. This grants superuser access to manage clinics

## Clinic Login

Clinic login works the same way:
1. Go to `/clinic-login`
2. Use the username and password set when creating the clinic

## Troubleshooting

### Database Connection Issues
- Ensure `DATABASE_URL` is correctly set
- Check that the database is in the same Render region as your web service

### CORS Errors
- Verify `FRONTEND_URL` matches your actual frontend URL exactly
- Include the protocol (https://)

### Session Issues
- Ensure `SESSION_SECRET` is set and matches between deployments
- Check that cookies are being set with `SameSite=None; Secure` in production

## Costs Summary

| Service | Free Tier | After Free Tier |
|---------|-----------|-----------------|
| Frontend (Static Site) | Always Free | Always Free |
| Backend (Web Service) | 750 hours/month | ~$7/month |
| PostgreSQL | 1 month | ~$7/month |

**Total after free tier: ~$14/month**

## Alternative: Replit Deployment

If you want simpler deployment with no additional costs beyond your Replit plan, use Replit's built-in publishing which handles everything automatically including the database and authentication.
