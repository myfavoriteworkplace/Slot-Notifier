# BookMySlot User Manual

**Version 1.0** | **Last Updated: January 2026**

---

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [User Roles](#user-roles)
4. [Public Booking Workflow](#public-booking-workflow)
5. [Super Admin Workflow](#super-admin-workflow)
6. [Clinic Admin Workflow](#clinic-admin-workflow)
7. [Demo Accounts](#demo-accounts)
8. [Features Overview](#features-overview)
9. [Troubleshooting](#troubleshooting)

---

## 1. Introduction

**BookMySlot** is a comprehensive booking management system designed for dental clinics and medical facilities. It streamlines the appointment booking process for both customers and clinic administrators.

### Key Features
- 🗓️ **Real-time Availability** - See open slots instantly
- 🔒 **Secure & Private** - Your data is protected
- 👥 **Role-based Access** - Different interfaces for customers, admins, and clinics
- 📧 **Email Notifications** - Automatic booking confirmations
- 📊 **Booking Analytics** - Track and manage appointments
- 🌓 **Theme Support** - Light and dark mode available

---

## 2. Getting Started

### Accessing the Application

**Production URL:** `https://book-my-slot-client.onrender.com`

### System Requirements
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Internet connection
- Email address for booking confirmations

---

## 3. User Roles

### 3.1 Public User (Customer)
- Can browse available clinics
- Book appointments
- Receive email confirmations
- **No login required** for basic booking

### 3.2 Super Admin
- Manage all clinics in the system
- Add new clinics
- Set clinic credentials
- Archive/unarchive clinics
- Toggle server logs
- **Access:** `/admin` page

### 3.3 Clinic Administrator
- View clinic bookings
- Create manual bookings
- Configure time slot availability
- Cancel bookings
- Generate bills (PDF)
- Download booking reports (CSV)
- **Access:** `/clinic-login` → `/clinic-dashboard`

---

## 4. Public Booking Workflow

### Step 1: Navigate to Booking Page
1. Visit the homepage
2. Click **"Book a Slot"** in the navigation bar
   - Or go directly to `/book`

### Step 2: Select a Clinic
1. Choose a clinic from the dropdown menu
2. Available clinics will be displayed
3. Demo clinics are marked with a 🧪 badge

![Select Clinic](https://via.placeholder.com/800x400?text=Select+Clinic+Screenshot)

### Step 3: Choose Date and Time
1. **Select a date:**
   - Use the horizontal date scroller (next 14 days)
   - Or use the calendar picker for custom dates
   - Dates marked "Full" are unavailable

2. **Enter your details:**
   - Full Name (required)
   - Phone Number (Indian format: +91 XXXXXXXXXX)
      - Email Address (required)

3. **Check available slots:**
   - Click "Check Available Slots"
   - Available time slots will appear:
     - Morning (9:00 AM - 12:00 PM)
     - Afternoon (2:00 PM - 4:00 PM)
     - Evening (4:00 PM - 6:00 PM)

![Select Time Slot](https://via.placeholder.com/800x400?text=Select+Time+Slot+Screenshot)

### Step 4: Confirm Booking
1. Select your preferred time slot
2. Click **"Confirm Booking"**
3. You'll receive:
   - ✅ On-screen confirmation
   - 📧 Email confirmation (to your provided email)
   - 📧 Email notification (to clinic, if configured)

![Booking Confirmation](https://via.placeholder.com/800x400?text=Booking+Confirmed+Screenshot)

---

## 5. Super Admin Workflow

### Logging In

1. Navigate to `/admin`
2. Enter admin credentials:
   - **Email:** Your admin email
   - **Password:** Your admin password
3. Click **"Login"**

![Admin Login](https://via.placeholder.com/800x400?text=Admin+Login+Screenshot)

### Managing Clinics

#### Adding a New Clinic

1. In the "Add New Clinic" card:
   - **Clinic Name** (required): e.g., "Downtown Dental"
   - **Address** (optional): e.g., "123 Main St"

2. Set login credentials:
   - **Username** (required): e.g., "downtown_dental"
   - **Password** (required): Secure password for clinic admin

3. Click **"Add Clinic"**

![Add Clinic](https://via.placeholder.com/800x400?text=Add+Clinic+Screenshot)

#### Editing Clinic Credentials

1. Find the clinic in the "Active Clinics" list
2. Click the **🔑 key icon** next to the clinic name
3. Update username and/or password
4. Click **"Save Credentials"**

#### Archiving a Clinic

1. Locate the clinic in "Active Clinics"
2. Click **📦 Archive icon**
3. Confirm the action
4. Archived clinics move to "Archived Clinics" section

#### Restoring an Archived Clinic

1. Scroll to "Archived Clinics" section
2. Click **♻️ Restore icon**
3. Clinic returns to active status

### Server Logs Toggle

- In the top-right corner, use the **"Server Logs"** switch
- **ON:** Backend logs all API requests (for debugging)
- **OFF:** Minimal logging for production

![Admin Panel](https://via.placeholder.com/800x400?text=Admin+Panel+Screenshot)

---

## 6. Clinic Admin Workflow

### Logging In

1. Navigate to `/clinic-login`
2. Enter your clinic credentials:
   - **Username:** Provided by Super Admin
   - **Password:** Provided by Super Admin
3. Click **"Login"**

💡 **Tip:** Click "Demo Credentials" to see demo account details

![Clinic Login](https://via.placeholder.com/800x400?text=Clinic+Login+Screenshot)

### Dashboard Overview

Upon login, you'll see:
- **Future Bookings:** Upcoming appointments
- **Past Bookings:** Historical appointments
- **Today's Bookings:** Appointments for current date
- **Filtered Bookings:** Based on selected date range

![Clinic Dashboard](https://via.placeholder.com/800x400?text=Clinic+Dashboard+Screenshot)

### Filtering Bookings

1. Use the date filter section:
   - **Start Date:** Beginning of date range
   - **End Date:** End of date range (optional)
   - **Reset:** Clear all filters

2. Or use the horizontal date scroller for quick day selection

### Creating Manual Bookings

1. Click **"+ Create Booking"** button
2. Enter patient details:
   - **Name** (required)
   - **Phone** (required, Indian format)
   - **Email** (required)
3. Select **booking date**
4. Choose available **time slot**
5. Click **"Confirm Booking"**

![Create Booking](https://via.placeholder.com/800x400?text=Create+Booking+Screenshot)

### Configuring Time Slots

1. Click **⚙️ Configure Slots** button
2. Select a date
3. Choose a time slot to configure
4. Set parameters:
   - **Max Bookings:** Maximum appointments for this slot (default: 3)
   - **Cancelled:** Toggle to disable/enable the slot
5. Click **"Save Configuration"**

![Configure Slots](https://via.placeholder.com/800x400?text=Configure+Slots+Screenshot)

### Cancelling Bookings

1. Find the booking in the list
2. Click **"Cancel Booking"** (🗑️ icon)
3. Confirm cancellation
4. System sends cancellation email to patient

### Generating Bills (PDF)

1. Click **"Generate Bill"** (🧾 icon) next to a booking
2. Review pre-filled patient information:
   - Name, Phone, Email, Date
3. Add/Edit services:
   - **Description:** e.g., "Dental Consultation"
   - **Amount:** e.g., "500"
   - Use **"+ Add Service"** for multiple items
   - Use **"× Remove"** to delete a service
4. Click **"Generate PDF"**
5. PDF downloads automatically

![Generate Bill](https://via.placeholder.com/800x400?text=Generate+Bill+Screenshot)

### Downloading Booking Reports

1. Apply date filters (if needed)
2. Click **"Download CSV"** (⬇️ icon) in the top-right
3. CSV file downloads with:
   - Patient Name
   - Phone Number
   - Booking Date
   - Time Slot

---

## 7. Demo Accounts

### Demo Super Admin

**Purpose:** Test admin panel without affecting real data

**Credentials:**
- **Email:** `demo_super_admin@bookmyslot.com`
- **Password:** Any password (bypassed)

**Features:**
- All admin features work
- Data stored in browser localStorage
- No backend calls made
- Persists across browser sessions

**How to Use:**
1. Go to `/admin`
2. Enter `demo_super_admin@bookmyslot.com`
3. Click "Login"
4. Demo admin panel loads instantly

### Demo Clinic

**Purpose:** Test clinic dashboard without setup

**Credentials:**
- **Username:** `demo_clinic`
- **Password:** `demo_password123`

**Features:**
- Pre-populated with 15 static bookings
- All dashboard features work
- Bookings stored in localStorage
- Linked to "Demo Smile Clinic"

**How to Use:**
1. Go to `/clinic-login`
2. Click "Demo Credentials" button to auto-fill
3. Click "Login"
4. Demo dashboard loads with sample data

---

## 8. Features Overview

### Theme Switcher

**Location:** Top-right corner of navigation bar (🌓 icon)

**Options:**
- **Light Mode:** Bright, high-contrast interface
- **Dark Mode:** Dark background, easier on eyes
- **System:** Auto-match your device settings

![Theme Switcher](https://via.placeholder.com/800x400?text=Theme+Switcher+Screenshot)

### Email Notifications

**Booking Confirmations:**
- Sent to customer's email
- Sent to clinic's email (if configured)
- Includes:
  - Patient name
  - Clinic name
  - Date and time
  - Booking confirmation message

**Cancellation Emails:**
- Sent when booking is cancelled
- Includes:
  - Cancellation notice
  - Original booking details
  - Contact information

**Requirements:**
- Backend must have `RESEND_API_KEY` configured
- Valid `EMAIL_FROM` address set

**Testing Email (Admin Only):**
```bash
curl -X POST https://book-my-slot-1.onrender.com/api/test-email \
     -H "Content-Type: application/json\" \
     -d '{"email": "your-email@example.com"}'
```

### Slot Configuration

**Default Slots:**
- **Morning:** 9:00 AM - 12:00 PM
- **Afternoon:** 2:00 PM - 4:00 PM
- **Evening:** 4:00 PM - 6:00 PM

**Customization:**
- Clinic admins can configure max bookings per slot
- Can cancel/disable specific time slots
- Settings apply per date and time combination

### Responsive Design

The application works seamlessly on:
- 💻 **Desktop** (1920x1080 and above)
- 💻 **Laptop** (1366x768 and above)
- 📱 **Tablet** (768x1024)
- 📱 **Mobile** (375x667 and above)

---

## 9. Troubleshooting

### Common Issues

#### \"Login failed\" for Admin

**Cause:** Invalid credentials or session issue

**Solution:**
1. Verify email and password are correct
2. Clear browser cookies and cache
3. Try in incognito/private mode
4. Contact system administrator

#### \"Slot already full\" when booking

**Cause:** Maximum bookings reached for that slot

**Solution:**
1. Choose a different time slot
2. Select a different date
3. Contact clinic directly

#### Email confirmation not received

**Cause:** Email service not configured or email in spam

**Solution:**
1. Check spam/junk folder
2. Verify email address was entered correctly
3. Contact clinic to confirm booking
4. (Admin) Check `RESEND_API_KEY` configuration

#### \"Not authenticated\" error in Clinic Dashboard

**Cause:** Session expired or not logged in

**Solution:**
1. Go to `/clinic-login` and log in again
2. Clear browser cache
3. Ensure cookies are enabled

#### Theme not switching

**Cause:** Browser localStorage issue

**Solution:**
1. Refresh the page
2. Clear browser cache and localStorage
3. Try a different browser

### Browser Compatibility

✅ **Supported:**
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

⚠️ **Limited Support:**
- Internet Explorer (not recommended)

### Getting Help

For additional support:
- 📧 Email: support@bookmyslot.com
- 📞 Phone: +91 XXXXXXXXXX
- 🌐 Website: https://bookmyslot.com

---

## Appendix A: Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Esc` | Close open dialogs |
| `Tab` | Navigate form fields |
| `Enter` | Submit forms |
| `Space` | Toggle switches |

---

## Appendix B: API Endpoints (For Developers)

**Base URL:** `https://book-my-slot-1.onrender.com`

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/clinics` | GET | List all active clinics |
| `/api/public/bookings` | POST | Create public booking |
| `/api/auth/admin/login` | POST | Admin authentication |
| `/api/clinic/login` | POST | Clinic authentication |
| `/api/clinic/bookings` | GET | Fetch clinic bookings |
| `/api/clinic/slots/configure` | POST | Configure slot settings |
| `/api/test-email` | POST | Test email configuration |

---

## Appendix C: Environment Variables

**Backend Configuration:**

```env
ADMIN_EMAIL=your-admin@example.com
ADMIN_PASSWORD=secure-password
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM=BookMySlot <noreply@bookmyslot.com>
FRONTEND_URL=https://book-my-slot-client.onrender.com
NODE_ENV=production
```

**Frontend Configuration:**

```env
VITE_API_URL=https://book-my-slot-1.onrender.com
```

---

## Revision History

| Version | Date | Changes |
|---------|------|----------|
| 1.0 | Jan 2026 | Initial release |

---

**© 2026 BookMySlot. All rights reserved.**
