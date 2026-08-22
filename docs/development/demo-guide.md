# BookMySlot — Demo Guide

A quick walkthrough of the demo accounts we set up, what's pre-loaded, and what you can explore.

---

## How to Start the Demo

1. Open the app and click **Clinic Portal** in the top navigation.
2. You'll land on the login page with two tabs — **Clinic Admin** and **Doctor**.
3. Click **Try Demo →** on either tab.
4. You're logged in instantly — no typing, no credentials needed.

---

## Demo Account 1 — Clinic Admin

**Tab:** Clinic Admin  
**Username:** `demo_clinic`  
**Password:** `demo_password123`

This is the main management view — what a clinic owner or receptionist would use every day.

### What's already set up

**Clinic profile**
- Name: Demo Smile Clinic
- Location: 12 Dental Avenue, MG Road, Kochi — 682001
- Phone: 9876543210

**Two doctors on the team**
- Dr. Priya Menon — Orthodontics, BDS MDS
- Dr. Arjun Nair — Dental Surgery, BDS

**17 real-looking patient bookings** spread across time:

| Period | Bookings | What to notice |
|---|---|---|
| Past 6 days | 6 bookings | Completed and cancelled appointments — shows history |
| Today | 3 bookings | One approved, one awaiting doctor approval, one still pending |
| Next 8 days | 8 bookings | Mix of confirmed, pending, and unassigned appointments |

**Sample patients you'll see:**
- Ananya Krishnan — Routine checkup and scaling (completed)
- Meera Pillai — Braces consultation (completed, has a clinical record)
- Rahul Varma — Denture fitting (pending, not yet confirmed)
- Nisha Raj — Invisalign consultation (upcoming, doctor approved)
- Amrita Sinha — Second opinion on implant (upcoming, pending)

**Open slots available**
- 28 free slots across the next 7 days (4 slots per day)
- These show up on the patient-facing booking page as available times

**Clinical record**
- One record for Meera Pillai's braces consultation
- Includes: diagnosis (mild dental crowding, Class I malocclusion), prescription, and treatment notes

### Things to try as Clinic Admin

- Browse the appointment list and filter by date or status
- Open a booking to see patient details, assigned doctor, and approval state
- View the clinical record attached to Meera Pillai's booking
- Check the available slots on the calendar

---

## Demo Account 2 — Doctor

**Tab:** Doctor  
**Email:** `demo.doctor@bookmyslot.in`  
**Password:** `demo_doctor123`

This is the doctor's personal dashboard — what Dr. Priya Menon would see when she logs in.

### What's already set up

**Doctor profile**
- Name: Dr. Priya Menon
- Specialisation: Orthodontics
- Degree: BDS, MDS — Government Dental College, Kochi
- Experience: 8 years
- Languages: English, Malayalam, Hindi
- Bio: Focused on smile correction, braces, and dental alignment

**3 certifications**
- Advanced Orthodontics — Indian Orthodontic Society, 2019
- Invisalign Certified Provider — Align Technology, 2021
- Dental Implant Basics — IDA Continuing Education, 2020

**2 patient case studies**
- *Crowding Correction with Braces* — 18-month treatment for a 17-year-old, metal brackets, IPR at 6 months
- *Invisalign for Adult Patient* — 14 aligners, mild spacing correction, completed in 9 months

**Bookings assigned to her**
- Several appointments across past, today, and upcoming days
- Statuses vary: some approved by her, one still pending her approval, some completed

### Things to try as Doctor

- See the appointments assigned to you in the dashboard
- Find the booking with status "pending your approval" and approve or decline it
- View your public profile as a patient would see it

---

## A Note on Demo Data

- The demo data is created automatically every time the server starts fresh — so it's always ready.
- Booking dates are always relative to today's date, so the calendar never looks stale.
- This is a sandbox — feel free to click around, make changes, and explore. Nothing here affects any real clinic or patient.
- If you want a completely clean slate, a server restart rebuilds all the demo data from scratch.
