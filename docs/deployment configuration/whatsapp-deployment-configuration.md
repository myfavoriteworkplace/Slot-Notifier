# WhatsApp Deployment Configuration

This guide explains how to configure WhatsApp notifications for the BookMySlot
backend deployment. It covers all providers currently supported by the
application:

- Twilio WhatsApp
- Meta WhatsApp Cloud API
- Zavu WhatsApp

The application sends WhatsApp messages only from the backend. Provider
credentials must never be placed in the frontend Static Site, a `VITE_*`
variable, source code, or a committed `.env` file.

## 1. What the application sends

The WhatsApp service supports three notification types:

| Notification | Trigger | Label in logs |
|---|---|---|
| Booking received | Patient submits an appointment request | `booking-received` |
| Booking confirmed | Clinic confirms an appointment, or an assigned doctor approves it | `booking-confirmed` |
| Consent request | Clinic or doctor requests a digital consent form | `consent-request` |

The clinic dashboard also has a manual reminder action. That action sends a
free-form WhatsApp message with the `generic` label.

The clinic confirmation request is:

```text
PATCH /api/auth/clinic/bookings/:id/confirm
```

The booking is saved first. WhatsApp is then attempted in a fire-and-forget
operation. A WhatsApp provider failure does not undo the booking confirmation.
Delivery is therefore verified through the provider dashboard and backend
logs, not from the booking response alone.

## 2. Application architecture

The provider-neutral service is `server/whatsapp.service.ts`. Routes import
only this service and do not call Twilio, Meta, or Zavu directly.

| File | Responsibility |
|---|---|
| `server/whatsapp.service.ts` | Selects the active provider and applies fallback behavior |
| `server/twilio.service.ts` | Sends free-form WhatsApp messages using the Twilio SDK |
| `server/meta-whatsapp.service.ts` | Sends approved WhatsApp templates through Meta Graph API |
| `server/zavu-whatsapp.service.ts` | Sends free-form WhatsApp messages through the Zavu SDK |
| `server/routes.ts` | Triggers notifications after booking and consent events |

The provider is selected once when the backend starts:

```text
WHATSAPP_PROVIDER=twilio
```

Supported values are `twilio`, `meta`, and `zavu`. If the variable is missing,
the application defaults to `twilio`.

Changing a provider variable requires a backend restart or redeploy. The
backend does not read a new provider selection for each request.

## 3. Environment variable reference

Set backend variables in the Render **Web Service** environment. Do not set
these in the Render frontend Static Site.

### 3.1 Provider selection

| Variable | Allowed value | Required | Notes |
|---|---|---:|---|
| `WHATSAPP_PROVIDER` | `twilio`, `meta`, or `zavu` | No | Defaults to `twilio` |

### 3.2 Twilio variables

| Variable | Required for | Notes |
|---|---|---|
| `TWILIO_ACCOUNT_SID` | Twilio WhatsApp and Twilio SMS | Twilio account identifier beginning with `AC` |
| `TWILIO_AUTH_TOKEN` | Twilio WhatsApp and Twilio SMS | Backend-only Twilio authentication secret |
| `TWILIO_WHATSAPP_NUMBER` | Twilio WhatsApp | Sender number in E.164 format; defaults to the Twilio sandbox number if omitted |
| `TWILIO_MESSAGING_SERVICE_SID` | Twilio SMS only | Starts with `MG`; it is not used for WhatsApp |

The WhatsApp and SMS services share `TWILIO_ACCOUNT_SID` and
`TWILIO_AUTH_TOKEN`, but they use different sender configuration:

- WhatsApp uses `TWILIO_WHATSAPP_NUMBER`.
- SMS uses `TWILIO_MESSAGING_SERVICE_SID`.

Enabling `SMS_NOTIFICATIONS_ENABLED=true` does not enable WhatsApp.

### 3.3 Meta WhatsApp Cloud API variables

| Variable | Required for | Notes |
|---|---|---|
| `WHATSAPP_ACCESS_TOKEN` | Meta outbound messages | Permanent system-user access token; keep private |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta outbound messages | Numeric Meta phone-number ID, not the visible phone number |
| `WHATSAPP_VERIFY_TOKEN` | Meta webhook verification | Private string that must match the value entered in Meta |
| `WHATSAPP_BOOKING_TEMPLATE` | Booking-received messages | Defaults to `booking_received` |
| `WHATSAPP_CONFIRM_TEMPLATE` | Confirmation messages | Defaults to `booking_confirmed` |
| `WHATSAPP_CONSENT_TEMPLATE` | Consent messages | Defaults to `consent_request` |

The three template variables are optional in the environment because the
application has defaults. They are operationally required when the approved
Meta template names differ from those defaults.

### 3.4 Zavu variables

| Variable | Required for | Notes |
|---|---|---|
| `ZAVUDEV_API_KEY` | Zavu outbound messages | Use the live Zavu key for production |

## 4. Render configuration

### 4.1 General rules

1. Open the Render backend Web Service, not the frontend Static Site.
2. Add or update the variables for exactly one primary provider.
3. Keep credentials in Render's secret/environment store.
4. Save the changes and wait for the backend restart to finish.
5. Confirm the startup log identifies the intended provider.
6. Make a controlled test booking and inspect the backend log and provider
   dashboard.

Do not add WhatsApp credentials as:

```text
VITE_TWILIO_ACCOUNT_SID
VITE_TWILIO_AUTH_TOKEN
VITE_WHATSAPP_ACCESS_TOKEN
```

Any `VITE_*` value can be included in browser-delivered frontend assets and is
not appropriate for a secret.

### 4.2 Example: Twilio WhatsApp

Use placeholders only in documentation, tickets, or local templates:

```dotenv
WHATSAPP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=<twilio-auth-token>
TWILIO_WHATSAPP_NUMBER=+919xxxxxxxxx
```

For sandbox testing, the sender can be:

```dotenv
TWILIO_WHATSAPP_NUMBER=+14155238886
```

The default sandbox number is used if `TWILIO_WHATSAPP_NUMBER` is omitted, but
explicitly setting it makes the deployment configuration easier to audit.

### 4.3 Example: Meta WhatsApp Cloud API

```dotenv
WHATSAPP_PROVIDER=meta
WHATSAPP_ACCESS_TOKEN=<permanent-meta-system-user-token>
WHATSAPP_PHONE_NUMBER_ID=<numeric-meta-phone-number-id>
WHATSAPP_VERIFY_TOKEN=<long-random-webhook-verification-string>
WHATSAPP_BOOKING_TEMPLATE=booking_received
WHATSAPP_CONFIRM_TEMPLATE=booking_confirmed
WHATSAPP_CONSENT_TEMPLATE=consent_request
```

The access token and verify token are secrets. Template names are not usually
secret, but must match the approved names exactly, including spelling and
capitalization.

### 4.4 Example: Zavu

```dotenv
WHATSAPP_PROVIDER=zavu
ZAVUDEV_API_KEY=zv_live_<zavu-live-key>
```

Do not use a test key for the production backend unless the recipient number
has been explicitly registered and the test behavior is intended.

## 5. Twilio WhatsApp setup

Twilio is the default provider and the permanent fallback provider for
Meta/Zavu failures.

### 5.1 Create or access the Twilio account

1. Sign in to the Twilio Console.
2. Copy the **Account SID** into `TWILIO_ACCOUNT_SID`.
3. Copy the **Auth Token** into `TWILIO_AUTH_TOKEN`.
4. Store both values only in the Render backend environment.

The application creates the Twilio client only when both values are present.
Without them, WhatsApp messages are skipped.

### 5.2 Twilio WhatsApp Sandbox for testing

The sandbox is suitable for controlled development or acceptance testing.

1. In Twilio Console, open **Messaging → Try it out → Send a WhatsApp
   message**.
2. Note the sandbox sender number, normally `+14155238886`.
3. Set `TWILIO_WHATSAPP_NUMBER` to that number.
4. Each test recipient must send the displayed join code from their WhatsApp
   account to the sandbox number.
5. Confirm the recipient has joined the sandbox before testing a booking.

A Twilio message SID does not guarantee delivery to a recipient who has not
joined the sandbox. Trial accounts also restrict which recipient numbers can
receive messages.

### 5.3 Twilio production WhatsApp sender

For production traffic:

1. Open **Messaging → Senders → WhatsApp Senders** in Twilio Console.
2. Add or connect the WhatsApp Business number.
3. Complete the required Meta Business and sender verification steps.
4. Confirm the number is approved for WhatsApp messaging.
5. Set `TWILIO_WHATSAPP_NUMBER` to the approved number in E.164 format, such
   as `+919xxxxxxxxx`.
6. Confirm the number is enabled for the Twilio WhatsApp channel.

Do not leave the sandbox number configured on the production backend.

### 5.4 Twilio message and template limitations

The current Twilio implementation sends free-form message text through:

```text
from: whatsapp:<configured sender>
to: whatsapp:<patient number>
body: <message text>
```

For a patient who has not recently exchanged messages with the business,
WhatsApp provider rules may require an approved template rather than a
free-form message. The current Twilio service does not select a Twilio
template SID. If a production sender rejects a free-form first-contact
message, the failure appears in the Twilio error log and the booking remains
confirmed.

The Twilio implementation normalizes Indian mobile numbers by adding `+91`
when a ten-digit number is supplied. International numbers should be stored
in E.164 format.

### 5.5 Expected Twilio startup and send logs

Successful initialization:

```text
[WHATSAPP] Twilio client initialized successfully.
```

Successful confirmation request:

```text
[WHATSAPP] (booking-confirmed) Attempting to send to +91...
[WHATSAPP] (booking-confirmed) Sent. SID: SM... → +91...
```

Missing credentials:

```text
[WHATSAPP] Twilio credentials missing — WhatsApp notifications disabled.
[WHATSAPP MOCK] Twilio not configured — booking-confirmed skipped.
```

## 6. Meta WhatsApp Cloud API setup

Meta is the appropriate provider when the deployment has a WhatsApp Business
account, an approved phone number, and approved utility templates.

### 6.1 Create and configure the Meta app

1. Open the Meta for Developers portal.
2. Create or select a Business app.
3. Add the WhatsApp product.
4. Connect the correct Meta Business account.
5. Add or select the WhatsApp Business phone number.
6. Copy the numeric **Phone Number ID** into `WHATSAPP_PHONE_NUMBER_ID`.

The Phone Number ID is not the visible sender phone number. Do not put the
visible phone number in that variable.

### 6.2 Create a permanent access token

1. Open Meta Business Manager.
2. Create or select a system user.
3. Assign the system user to the Meta app and WhatsApp Business account.
4. Generate a permanent or long-lived system-user token.
5. Grant the minimum WhatsApp permissions required by the current Meta setup,
   including `whatsapp_business_messaging`.
6. Store the token as `WHATSAPP_ACCESS_TOKEN` in Render.

Do not use the short-lived token shown for initial Meta testing as the
production credential. Rotate a token immediately if it has been exposed in a
screenshot, log, ticket, chat, or repository.

### 6.3 Create and approve message templates

Meta outbound messages may require an approved template, particularly when
the business is initiating a conversation or the 24-hour customer-service
window is closed. Create utility templates for:

- Booking received
- Booking confirmed
- Consent request

The application sends template messages with language code `en`. The template
language and the approved template name must therefore be compatible with the
request sent by the application.

#### Booking-received parameters

The current service sends these four body parameters in this order:

1. Patient name
2. Clinic name
3. Appointment date
4. Appointment time

#### Confirmation parameters

The current service always sends these base parameters in this order:

1. Patient name
2. Clinic name
3. Appointment date
4. Appointment time

It then appends these values only when they are present:

5. Doctor name
6. Clinic address
7. Booking reference

The clinic confirmation route supplies a booking reference in the form
`BMS-<bookingId>`. Therefore, a Meta confirmation template must be reviewed
against the actual optional fields used by the deployment. A template with
only four variables will fail if the application sends an additional doctor,
address, or reference parameter. The approved template's parameter count and
order must match the request.

#### Consent parameters

The current service sends:

1. Patient name
2. Clinic name
3. Consent URL

After creating or changing a template, update the corresponding environment
variable and restart the backend.

### 6.4 Configure the Meta webhook

The application exposes these public routes:

```text
GET  /api/whatsapp-webhook
POST /api/whatsapp-webhook
```

Configure the Meta callback URL to the public backend URL:

```text
https://<backend-host>/api/whatsapp-webhook
```

Set the same private verification string in both Meta and Render:

```dotenv
WHATSAPP_VERIFY_TOKEN=<same-value-in-both-places>
```

The `GET` route verifies the webhook and returns Meta's challenge. The `POST`
route accepts WhatsApp delivery status events and logs their status. Delivery
status is not currently persisted in the BookMySlot database.

For outbound-only testing, the webhook is not needed to send the initial API
request, but it is recommended for delivery and read-status visibility.

### 6.5 Expected Meta logs

Successful initialization:

```text
[WHATSAPP-META] Meta Cloud API client ready.
[WHATSAPP] Active provider: meta
```

Successful confirmation request:

```text
[WHATSAPP-META] (booking-confirmed) Sending template "booking_confirmed" to +91...
[WHATSAPP-META] (booking-confirmed) Sent. Message ID: wamid... → +91...
```

Common failure indicators include a missing/expired access token, an
unapproved template, an incorrect Phone Number ID, a template-language
mismatch, or a parameter-count mismatch.

## 7. Zavu WhatsApp setup

Zavu is the simplest provider when free-form WhatsApp delivery is preferred
and a Zavu sender is available.

### 7.1 Create a live Zavu key

1. Sign in to the Zavu dashboard.
2. Open the API keys area.
3. Create a **Live** key for the production backend.
4. Configure a WhatsApp sender in Zavu.
5. Set that sender as the default sender.
6. Store the key in Render as `ZAVUDEV_API_KEY`.

The application sends the Zavu request with:

```text
channel: whatsapp
to: <patient number>
text: <free-form message>
```

Zavu does not use the Meta template variables in this application.

### 7.2 Expected Zavu logs

Successful initialization:

```text
[WHATSAPP-ZAVU] Zavu client initialized successfully.
[WHATSAPP] Active provider: zavu
```

Successful confirmation request:

```text
[WHATSAPP-ZAVU] (booking-confirmed) Sending to +91...
[WHATSAPP-ZAVU] (booking-confirmed) Sent → +91...
```

If the API key is missing, the service uses the Twilio fallback path:

```text
[WHATSAPP-ZAVU] ZAVUDEV_API_KEY not set — Zavu provider unavailable.
```

## 8. Provider selection and fallback

The primary provider and fallback behavior are:

| Configuration | Primary provider | Failure fallback |
|---|---|---|
| `WHATSAPP_PROVIDER=twilio` | Twilio | No second provider |
| `WHATSAPP_PROVIDER=meta` with Meta credentials | Meta | Twilio |
| `WHATSAPP_PROVIDER=zavu` with Zavu key | Zavu | Twilio |
| `WHATSAPP_PROVIDER=meta` without Meta credentials | Twilio | No second provider |
| `WHATSAPP_PROVIDER=zavu` without Zavu key | Twilio | No second provider |
| No `WHATSAPP_PROVIDER` | Twilio | No second provider |

When Meta or Zavu is selected and the primary provider throws an error, the
service attempts Twilio. Twilio must still have valid credentials and a valid
WhatsApp sender for that fallback to be useful.

The manual reminder action is a free-form generic message. Meta and Zavu do
not implement generic messages directly in this application, so their generic
message path intentionally falls back to Twilio.

## 9. Independent SMS configuration

WhatsApp and SMS are separate channels:

| Channel | Enable/configure with |
|---|---|
| WhatsApp | `WHATSAPP_PROVIDER` plus the selected provider credentials |
| SMS | `SMS_NOTIFICATIONS_ENABLED=true`, Twilio account credentials, and `TWILIO_MESSAGING_SERVICE_SID` |

Do not diagnose WhatsApp delivery by checking only
`SMS_NOTIFICATIONS_ENABLED`. That variable has no effect on WhatsApp.

The same Twilio Account SID and Auth Token can be shared by both services, but
the sender setup and message API configuration are different.

## 10. Deployment verification checklist

### Backend configuration

- [ ] `WHATSAPP_PROVIDER` is set to the intended value or intentionally left
      at the Twilio default.
- [ ] Required provider credentials are present on the backend Web Service.
- [ ] No WhatsApp credential is stored in the frontend Static Site.
- [ ] No secret is exposed through a `VITE_*` variable.
- [ ] The backend has restarted after the environment change.
- [ ] Startup logs identify the expected provider.

### Provider configuration

- [ ] Twilio sender is WhatsApp-enabled and in the correct sender format.
- [ ] Twilio sandbox recipients have joined the sandbox, if applicable.
- [ ] Meta phone number is approved and the Phone Number ID is correct.
- [ ] Meta templates are approved and their names match Render variables.
- [ ] Meta template parameters match the application's order and count.
- [ ] Meta webhook verification succeeds when a webhook is configured.
- [ ] Zavu has a live key and a configured default WhatsApp sender.

### End-to-end test

1. Use a test patient with a valid WhatsApp-capable phone number.
2. Create or identify a booking that is eligible for confirmation.
3. Confirm the booking from the clinic dashboard.
4. Verify the booking confirmation succeeds.
5. Search backend logs for `booking-confirmed`.
6. Confirm the provider returned a Twilio SID, Meta message ID, or Zavu
   success log.
7. Check the provider's message history for the final delivery status.
8. Confirm that the patient received the message.

The booking response alone is not proof of WhatsApp delivery because the
notification is best-effort.

## 11. Troubleshooting

| Symptom | Likely cause | Action |
|---|---|---|
| No WhatsApp log after confirmation | Booking has no `customerPhone`, route was not reached, or backend logs were not inspected | Confirm the patient phone exists and search for `booking-confirmed` |
| `Twilio credentials missing` | Account SID or Auth Token absent | Add both to the backend environment and restart |
| `Twilio not configured` | Twilio fallback or primary provider has no usable Twilio credentials | Configure the Twilio credentials and sender |
| Twilio SID exists but patient receives nothing | Sandbox not joined, trial restriction, invalid number, sender restriction, or provider delivery failure | Check Twilio message status and recipient/sender configuration |
| Meta `401` or authorization error | Token is expired, invalid, or lacks permission | Generate/rotate the system-user token and update Render |
| Meta template error | Template not approved, wrong name, wrong language, or wrong parameter count/order | Compare the approved template with the current parameter contract |
| Meta webhook verification returns `403` | Verify token mismatch or missing backend variable | Set the same `WHATSAPP_VERIFY_TOKEN` in Meta and Render |
| Zavu key missing | `ZAVUDEV_API_KEY` is absent or not loaded after restart | Add a live key and restart the backend |
| Zavu sender failure | No default WhatsApp sender or sender is not approved | Configure the sender in Zavu |
| Booking confirms but message fails | Expected best-effort behavior | Use backend logs and the provider dashboard; do not retry by changing booking state blindly |
| SMS works but WhatsApp does not | SMS and WhatsApp use separate configuration | Check `WHATSAPP_PROVIDER` and WhatsApp-specific variables |

## 12. Security and operational rules

- Keep all provider secrets in Render's backend secret/environment store.
- Never paste access tokens, auth tokens, API keys, or full credentials into
  documentation or tickets.
- Rotate a credential immediately if it appears in a screenshot, log, chat, or
  source-control history.
- Use the minimum Meta permissions required by the WhatsApp integration.
- Do not print message bodies or full patient phone numbers in operational
  logs.
- Treat provider message IDs and delivery dashboards as the delivery-history
  source. The application does not currently persist WhatsApp delivery state.
- Test provider changes with a controlled recipient before switching live
  traffic.

## Related documents

- [WhatsApp notification layer](../notifications/whatsapp-notification-layer.md)
- [Reminder deployment configuration](reminder-deployment-configuration.md)
- [Render environment setup](../development/render-environment-setup.md)
- [Deployment environment variables inventory](environment-variables-inventory.md)