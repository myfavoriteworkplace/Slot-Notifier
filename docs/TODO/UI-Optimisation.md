# UI Optimisation

## Scope

This pass addresses minor alignment, spacing, and responsive wrapping issues
identified in the clinic and doctor admin patient cards and the clinic booking
detail dialog.

## Completed changes

- Made appointment action chips content-sized instead of allowing them to
  visually stretch across the entire value column.
- Added consistent wrapping and truncation constraints for long assignment,
  consent, and patient-detail values.
- Rebalanced the appointment-card header action cluster so status, menu, and
  collapse controls no longer form a loose vertical stack.
- Reduced the clinic overflow-menu footprint while preserving the full
  interactive target and added an accessible label.
- Aligned past-due banner text, icon, and reschedule action when the message
  wraps.
- Added an inset override so the detail-dialog status banner aligns with the
  patient information panel rather than receiving a second nested horizontal
  inset.
- Applied the primary-full-width and secondary-wrapping footer structure to
  doctor appointment cards as well as clinic cards.
- Kept appointment lifecycle policy and server-authoritative actions unchanged.

## Validation

- Run the TypeScript check and production build after implementation.
- Restart the application workflow and inspect the clinic and doctor card
  surfaces.
- Check representative desktop and narrow layouts for:
  - Assigned Doctor and Consent action-chip width.
  - Header action alignment.
  - Warning-banner edge alignment and wrapping.
  - Equal-height card footer alignment.
  - Doctor and clinic footer wrapping.
  - Detail-dialog overview and persistent footer alignment.

## Remaining manual check

Authenticated browser automation may be unavailable in this workspace when
Chromium cannot load native `libgbm`/`libudev` libraries. If that limitation is
present, the narrow-width inspection should be completed in a browser before
marking this document fully signed off.