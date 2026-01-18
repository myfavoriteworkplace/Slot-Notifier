# Health Check Endpoints Summary

If you are experiencing 404 errors in production (Render) while they work locally, ensure your backend is correctly configured to handle requests on all methods (using `app.all`) and that the API routes are registered before static file serving.

| Endpoint | Method | Local URL (Example) | Production URL (Example) |
|----------|--------|----------------------|---------------------------|
| **Combined Health** | GET/ALL | `http://localhost:5000/api/health` | `https://your-app.onrender.com/api/health` |
| **Backend Status** | ALL | `http://localhost:5000/api/health/backend` | `https://your-app.onrender.com/api/health/backend` |
| **Database Status** | ALL | `http://localhost:5000/api/health/database` | `https://your-app.onrender.com/api/health/database` |
| **Admin Login** | POST/ALL | `http://localhost:5000/api/auth/admin/login` | `https://your-app.onrender.com/api/auth/admin/login` |

### Troubleshooting 404 in Production:
1. **Route Matching**: Ensure the request path matches exactly (case-sensitive and including/excluding trailing slashes depending on configuration).
2. **Method Support**: We have updated the backend to use `app.all()` for these health checks to ensure they respond regardless of specific header requirements or proxies that might alter the request.
3. **CORS**: Ensure your `FRONTEND_URL` environment variable on Render includes the exact domain of your client.
