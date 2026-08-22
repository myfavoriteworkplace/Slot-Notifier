# SMS Notification Layer — BookMySlot

## Purpose

BookMySlot can send transactional appointment SMS through Twilio. SMS is a backend-only channel and is controlled by a Render environment switch. It does not expose Twilio credentials or configuration to the browser.

SMS is disabled by default. Booking and confirmation operations continue normally if SMS is disabled, misconfigured, or temporarily unavailable.

## Notification events

| Event | SMS sent | Message |
|---|---:|---|
| Patient submits a normal booking request | Yes | Booking received; asks the patient to wait for confirmation |
| Clinic admin confirms a booking | Yes | Appointment confirmed |
| Assigned doctor approves a booking | Yes | Appointment confirmed |
| Paid booking completes | Yes | Appointment confirmed |
| Clinic creates an admin/walk-in booking | Yes | Appointment confirmed |
| Digital consent request | No | Consent remains WhatsApp-only |

For a normal patient booking, the patient receives two SMS messages over the lifecycle: one received message and one confirmation message. Paid and admin-created bookings receive only the confirmation message.

## Application architecture

The implementation is split into:

| File | Responsibility |
|---|---|
| `server/sms.service.ts` | Twilio client, enable switch, phone normalization, message formatting, safe logging, and failure handling |
| `server/routes.ts` | Calls the SMS service after each relevant booking event |
| `.env.example` | Local environment template |
| `.env.render.backend.example` | Render backend environment template |
| `docs/development/render-environment-setup.md` | Full Render variable reference |

The existing `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` are shared with the WhatsApp integration. SMS uses a Twilio Messaging Service SID instead of putting a sender number in application code.

## Twilio Console setup

### 1. Create a Messaging Service

1. Sign in to the [Twilio Console](https://console.twilio.com/).
2. Open **Messaging → Services**.
3. Create a service, for example `BookMySlotSMS`.
4. Choose the **Transactional** use case.
5. Copy the Messaging Service SID. It starts with `MG`.

### 2. Add a sender

1. Open the new Messaging Service.
2. Go to **Senders** or **Sender Pool**.
3. Add the Twilio trial phone number or an approved production sender.
4. Save the sender pool.

In Twilio trial mode, SMS can only be delivered to destination numbers verified in the Twilio Console. This is separate from the sender configuration.

### 3. Configure inbound integration

For outbound appointment SMS, no inbound webhook is required. Twilio’s default “receive the message” option is sufficient for a prototype. BookMySlot does not currently process patient SMS replies.

If replies are needed later, configure a webhook and add a dedicated inbound route. Do not assume that a reply webhook is required for sending confirmation messages.

## Render backend variables

Add these to the **Render Web Service backend** environment, not the frontend Static Site:

```env
SMS_NOTIFICATIONS_ENABLED=false
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Variable behavior

| Variable | Required | Meaning |
|---|---:|---|
| `SMS_NOTIFICATIONS_ENABLED` | Yes to send | Must be exactly `true` (case-insensitive after trimming) to allow SMS |
| `TWILIO_ACCOUNT_SID` | Yes to send | Twilio account identifier |
| `TWILIO_AUTH_TOKEN` | Yes to send | Twilio secret; backend only |
| `TWILIO_MESSAGING_SERVICE_SID` | Yes to send | Messaging Service used to select the sender |

The app reuses the Twilio account SID and auth token for WhatsApp. Do not create `VITE_TWILIO_*` variables. Anything with a `VITE_` prefix is intended for the browser and would be the wrong place for Twilio secrets.

### Turn SMS on

1. Complete the Twilio Messaging Service and sender setup.
2. Add the three Twilio variables to the Render backend.
3. Set:

```env
SMS_NOTIFICATIONS_ENABLED=true
```

4. Click **Save Changes** in Render.
5. Wait for the backend restart to complete.
6. Test with a destination number verified in Twilio if the account is still in trial mode.

### Turn SMS off

Set:

```env
SMS_NOTIFICATIONS_ENABLED=false
```

or remove the variable. Render restarts the backend and no SMS request will be made. WhatsApp and email behavior are unaffected.

## Phone number handling

The service accepts:

- Indian 10-digit mobile numbers and adds `+91`
- Indian numbers beginning with `91` and adds `+`
- International numbers already in E.164 form, such as `+14155552671`

Invalid numbers are skipped and logged as a configuration/input warning. The service does not print the message body or the full phone number in logs.

## Failure behavior and logging

SMS is best-effort. A Twilio outage, invalid destination, missing variable, or trial restriction must not prevent a booking from being created or confirmed.

Useful backend log examples:

```text
[SMS] SMS notifications disabled by SMS_NOTIFICATIONS_ENABLED.
[SMS] Twilio SMS client initialized successfully.
[SMS] (booking-received) Sent. SID: SM... → +91••••12
[SMS] (booking-confirmed) Sent. SID: SM... → +91••••12
[SMS ERROR] (booking-confirmed) Twilio error code: ...
```

The message SID is logged for troubleshooting. Delivery status is not persisted in the BookMySlot database yet. For delivery history, use the Twilio Console.

## Trial and India production considerations

### Trial mode

- Only Twilio-verified destination numbers can receive SMS.
- Trial messages may include Twilio trial account restrictions.
- Verify the patient test number in Twilio before testing a booking.
- Use a real Messaging Service and sender pool even during testing so production configuration is not accidentally mixed into application code.

### Production in India

Before sending live healthcare notifications in India, confirm the current Twilio and telecom requirements for the sender and message templates. Depending on the traffic and sender route, production may require:

- DLT registration
- An approved sender/header
- Pre-approved transactional templates
- Correct template IDs and telecom route configuration
- Applicable consent and opt-out handling

Do not treat a Twilio trial success as proof that the production India route is ready. Appointment confirmation messages should remain transactional, not marketing content.

## Security checklist

- Keep `TWILIO_AUTH_TOKEN` only in backend secrets/environment settings.
- Never add Twilio credentials to `client/src` or a `VITE_*` variable.
- Do not hardcode sender numbers or credentials in source code.
- Limit SMS triggers to server-side booking state transitions.
- Keep logs free of message bodies and full patient phone numbers.
- Review the Twilio Console message logs and account permissions periodically.

## Troubleshooting

| Symptom | Likely cause | Action |
|---|---|---|
| SMS does not send and logs say disabled | `SMS_NOTIFICATIONS_ENABLED` is missing or not `true` | Set it to `true` on the Render backend |
| SMS does not send and logs say credentials missing | SID, auth token, or Messaging Service SID is missing | Add all backend variables and restart |
| Twilio returns an authorization error | Account SID/auth token is wrong or revoked | Replace the backend secret values |
| Twilio returns a sender error | Sender was not added to the Messaging Service | Add/verify the sender pool in Twilio |
| Trial recipient gets no SMS | Destination number is not verified | Verify it in Twilio Console |
| Booking succeeds but SMS fails | Expected best-effort behavior | Check `[SMS ERROR]` logs and Twilio message logs |
| Consent screen mentions SMS | Consent is intentionally WhatsApp-only | The UI copy should say WhatsApp only |

*Last updated: August 2026*