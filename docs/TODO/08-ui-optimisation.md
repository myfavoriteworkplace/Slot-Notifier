# Patient-card UI optimisation

**Status:** Implemented  
**Date:** August 15, 2026  
**Scope:** Clinic and doctor admin appointment cards and patient overview popups

## Purpose

This document records the focused UI consistency pass for the patient-card surfaces. The work responds to the uploaded screenshots and the accompanying review of spacing, content-sized action pills, warning banners, header controls, and popup actions.

## Findings and resolution

### 1. Content-sized action pills

Action controls such as **Assign Doctor** and **Send Link** were placed in the flexible value column of a CSS grid. Without an explicit self-alignment rule, grid items could stretch to the full remaining column width.

The controls now use the shared intent of:

- `inline-flex`
- `justify-self-start`
- `min-w-0`
- `max-w-full`

This keeps the green action pill close to its content while still allowing long labels to wrap or be constrained on narrow screens.

### 2. Consistent row behavior

The compact card and both popup overview panels use icon, label, and value columns. The value-side action wrappers now also use content-sized alignment and responsive wrapping so long doctor names, consent states, and actions do not widen or distort the card.

### 3. Warning-banner inset

The shared appointment-status section previously applied its own horizontal margin. Popup overview panels already have horizontal padding, so the warning banner received a second inset and no longer aligned with the patient-information card.

The shared component now supports an explicit `inset` option:

- Compact cards retain the existing card-aligned inset.
- Clinic and doctor popup overview panels opt out of the extra margin and align the banner with their information panel.

The past-due warning also aligns its icon, wrapped message, and reschedule action from the top of the row so multi-line messages remain readable.

### 4. Header collapse affordance

The compact card had a collapse button in the header action stack while the date/details row already provided the responsive collapse affordance. The duplicate header control made the right side of the header appear vertically disconnected.

The duplicate header control was removed. The existing date/clinic-details interaction remains the collapse/expand entry point.

### 5. Popup footer

The current clinic and doctor popup footer implementations already use full-width primary action containers and full-width lifecycle buttons where appropriate. No separate footer rewrite was made; changing those branches would risk regressing the shared booking-action policy.

## Deliberately unchanged

- Booking lifecycle behavior
- Appointment footer action eligibility
- Patient or booking data models
- API routes and persistence
- Equal-height appointment-card behavior
- Existing color semantics for status, treatment, consent, and warnings

## Verification checklist

- [x] Action pills are content-sized in compact and popup views.
- [x] Long values retain `min-w-0`/wrapping constraints.
- [x] Popup warning banners align with the information card.
- [x] Compact header no longer duplicates the collapse control.
- [x] Clinic and doctor popup footer structure remains intact.
- [ ] Validate the final layout at narrow mobile width and desktop preview widths after the next visual review.