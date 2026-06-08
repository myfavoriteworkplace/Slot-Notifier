# Cloudflare R2 Integration Guide - BookMySlot

This document provides a comprehensive guide for setting up Cloudflare R2 and understanding the integration within the BookMySlot project.

## 🚀 1. Cloudflare R2 Setup (Step-by-Step)

### Step 1: Sign up & Enable R2
- **Dashboard**: [dash.cloudflare.com](https://dash.cloudflare.com)
- Go to **R2** in the sidebar.
- You must have a valid billing method on file (even if staying within the generous free tier).

### Step 2: Create a Bucket
- Click **Create Bucket**.
- **Bucket Name**: `app-images` (or your preferred name).
- **Location**: Automatic.
- **Storage Class**: Standard.
- **Public Access**: Keep **Disabled** (Private).
- Click **Create Bucket**.

### Step 3: Create R2 API Credentials
- Go to **R2** (overview page) → **Manage R2 API Tokens**.
- Click **Create API Token**.
- **Token Name**: `bookmyslot-backend`.
- **Permissions**: `Object Read & Write`.
- **Bucket Scope**: Apply to specific buckets only → `app-images`.
- Click **Create API Token**.
- **IMPORTANT**: Copy and save your **Access Key ID** and **Secret Access Key**. You will not be able to see the secret again.

### Step 4: Configure CORS (Critical for Uploads)
Direct uploads from the browser require a CORS policy.
- Go to **R2** → Select your bucket (`app-images`) → **Settings** → **CORS Policy**.
- Click **Add CORS Policy** and paste:
  ```json
  [
    {
      "AllowedOrigins": ["*"],
      "AllowedMethods": ["PUT", "GET"],
      "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3600
    }
  ]
  ```
  *(Note: For production, replace `"*"` in `AllowedOrigins` with your actual domain.)*

---

## 🛠 2. Project Integration Details

### Environment Variables
Configure these in your Render environment or `.env` file:
- `R2_ACCOUNT_ID`: Found in the R2 overview page (Account ID).
- `R2_ACCESS_KEY_ID`: Your API Access Key.
- `R2_SECRET_ACCESS_KEY`: Your API Secret Key.
- `R2_BUCKET_NAME`: `app-images`.
- `R2_PUBLIC_URL`: Your R2 Custom Domain or the `.r2.dev` subdomain (used as the base for key normalization).

### Implementation Architecture

#### 📤 Direct Browser Uploads
- **Backend (`server/signedUrl.service.ts`)**: Generates a temporary S3-compatible signed URL for `PUT` operations.
- **Frontend (`client/src/components/ImageUpload.tsx`)**: Sends the file directly to Cloudflare. This avoids taxing your server with large file transfers.
- **Storage**: We store the **Object Key** (e.g., `clinics/filename.png`) in the database, not the full URL.

#### 🔐 Secure Private Previews (Signed GET)
Since the bucket is private, direct URLs will show an XML error.
- **Backend (`server/routes.ts`)**: When the clinic profile is requested (`/api/auth/clinic/me`), the backend detects if `logoUrl` is a key and generates a temporary (1-hour) signed URL.
- **Security**: Images are never public. Access is only granted to authorized users through these short-lived links.

## 🛡️ Summary of Adaptations
| Feature | Implementation |
| :--- | :--- |
| **Storage Strategy** | Private Bucket + Object Keys in DB. |
| **Security** | Short-lived Signed GET URLs for viewing. |
| **Performance** | Signed PUT URLs for direct browser-to-R2 uploads. |
| **Reliability** | URL normalization to prevent double-slashes and malformed paths. |

