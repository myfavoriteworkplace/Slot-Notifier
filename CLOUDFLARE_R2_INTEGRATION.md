# Cloudflare R2 Integration Guide - BookMySlot

This document outlines the Cloudflare R2 integration implemented in the BookMySlot project for secure clinic logo management.

## 🚀 1. Setup in Cloudflare
- **Bucket Creation**: A private bucket (e.g., `app-images`) was created.
- **API Token**: A Custom API Token with `R2 Object Read & Write` permissions was generated.
- **CORS Configuration**: The following CORS policy was applied to allow direct uploads from the browser:
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

## 🛠 2. Project Adaptation

### A. Environment Configuration
The following variables are configured in the Render environment or `.env` file:
- `R2_ACCOUNT_ID`: Your Cloudflare Account ID.
- `R2_ACCESS_KEY_ID`: S3-compatible Access Key ID.
- `R2_SECRET_ACCESS_KEY`: S3-compatible Secret Access Key.
- `R2_BUCKET_NAME`: The name of your bucket.
- `R2_PUBLIC_URL`: The base public URL for your R2 bucket.

### B. Secure Signed Uploads
- **Backend (`server/signedUrl.service.ts`)**: Generates a temporary `PutObjectCommand` signed URL.
- **Frontend (`client/src/components/ImageUpload.tsx`)**: Uploads the file directly to R2 using the signed URL via a `PUT` request. This reduces backend load and improves security.

### C. Secure Signed Previews (GET)
Since the bucket is **private**, direct links will fail with an `InvalidArgument` error. We adapted the system to use **Signed GET URLs**:
- **Storage**: We only store the **Object Key** (e.g., `clinics/uuid.png`) in the database.
- **Retrieval (`server/routes.ts`)**: When fetching clinic info via `/api/auth/clinic/me`, the backend generates a temporary (1-hour) signed URL for the logo.
- **Security**: This ensures your bucket stays 100% private, and images are only accessible via short-lived, authorized links.

## 🛡️ Summary of Fixes Applied
| Issue | project Adaptation |
| :--- | :--- |
| **CORS Errors** | Configured R2 CORS policy to allow `PUT` from your domain. |
| **Private Access Denied** | Switched from public URLs to **Signed GET URLs** generated on-the-fly. |
| **URL Double Slashes** | Added logic to normalize `R2_PUBLIC_URL` by removing trailing slashes. |
| **Database Sync** | Added `logo_url` column to the `clinics` table to store object keys. |

