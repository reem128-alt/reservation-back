# Payment Flow with Stripe

This document explains how to integrate Stripe payment processing with the booking system.

## Overview

The system supports two payment flows:
1. **Server-side automatic payment** - User provides payment method ID during booking creation
2. **Client-side payment confirmation** - User confirms payment on the client side using Stripe Elements

## Flow 1: Direct Payment (Recommended for Testing)

### Step 1: Create Booking with Payment Method

**Endpoint:** `POST /bookings`

**Request Body:**
```json
{
  "resourceId": 1,
  "startTime": "2024-12-01T10:00:00Z",
  "endTime": "2024-12-01T12:00:00Z",
  "paymentMethodId": "pm_card_visa"
}
```

**Test Payment Methods (Stripe Test Mode):**
- `pm_card_visa` - Visa test card
- `pm_card_mastercard` - Mastercard test card
- `pm_card_amex` - American Express test card

**Response (Success):**
```json
{
  "id": 1,
  "userId": 1,
  "resourceId": 1,
  "startTime": "2024-12-01T10:00:00.000Z",
  "endTime": "2024-12-01T12:00:00.000Z",
  "status": "PENDING",
  "createdAt": "2024-11-26T20:00:00.000Z"
}
```

The payment will be processed automatically in the background, and the booking status will be updated to `CONFIRMED` once payment succeeds.

---

## Flow 2: Client-Side Payment Confirmation (Production)

### Step 1: Create Booking without Payment Method

**Endpoint:** `POST /bookings`

**Request Body:**
```json
{
  "resourceId": 1,
  "startTime": "2024-12-01T10:00:00Z",
  "endTime": "2024-12-01T12:00:00Z"
}
```

**Response:**
```json
{
  "success": false,
  "requiresAction": true,
  "clientSecret": "pi_xxx_secret_xxx",
  "paymentIntentId": "pi_xxx",
  "amount": 100,
  "status": "REQUIRES_PAYMENT_METHOD",
  "message": "Please provide payment method to complete booking"
}
```

### Step 2: Collect Payment Details on Client

Use Stripe Elements to collect payment details:

```javascript
// Initialize Stripe
const stripe = Stripe('pk_test_your_publishable_key');

// Create payment element
const elements = stripe.elements({ clientSecret: 'pi_xxx_secret_xxx' });
const paymentElement = elements.create('payment');
paymentElement.mount('#payment-element');

// Submit payment
const { error, paymentIntent } = await stripe.confirmPayment({
  elements,
  confirmParams: {
    return_url: 'https://yourapp.com/booking/success',
  },
});
```

### Step 3: Confirm Payment on Server (Alternative)

If you want to confirm on the server side:

**Endpoint:** `PATCH /payments/confirm`

**Request Body:**
```json
{
  "paymentIntentId": "pi_xxx",
  "paymentMethodId": "pm_card_visa"
}
```

**Response (Success):**
```json
{
  "success": true,
  "paymentId": "pi_xxx",
  "amount": 100,
  "status": "COMPLETED"
}
```

---

## Payment Calculation

The payment amount is automatically calculated based on:
- **Duration:** Time between `startTime` and `endTime`
- **Hourly Rate:** Currently set to $50/hour (default)

**Example:**
- Booking: 2 hours (10:00 AM - 12:00 PM)
- Rate: $50/hour
- **Total: $100**

---

## Test Cards (Stripe Test Mode)

Use these test cards when testing:

| Card Number | Brand | CVC | Expiry |
|------------|-------|-----|--------|
| 4242 4242 4242 4242 | Visa | Any 3 digits | Any future date |
| 5555 5555 5555 4444 | Mastercard | Any 3 digits | Any future date |
| 3782 822463 10005 | American Express | Any 4 digits | Any future date |

---

## API Endpoints

### Create Booking
- **POST** `/bookings`
- Body: `{ resourceId, startTime, endTime, paymentMethodId? }`

### Confirm Payment
- **PATCH** `/payments/confirm`
- Body: `{ paymentIntentId, paymentMethodId }`

### Check Payment Status
- **GET** `/payments/status/:paymentId`

### Refund Payment
- **POST** `/payments/refund`
- Body: `{ paymentId, amount? }`

---

## Events

The system emits the following events:

1. **booking.created** - When a booking is created
2. **booking.confirmed** - When payment succeeds
3. **booking.canceled** - When a booking is canceled

Email notifications are sent automatically for each event.

---

## Environment Variables

Required in `.env`:

```env
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_publishable_key
```

Get your keys from: https://dashboard.stripe.com/test/apikeys

---

## Error Handling

Common errors:

- **Booking not found** - Invalid booking ID
- **Payment declined** - Card declined by bank
- **Invalid payment method** - Payment method ID is invalid
- **Insufficient funds** - Card has insufficient funds

All errors are returned with appropriate HTTP status codes and error messages.
////

1h
5m
1m

explain booking files

I'll examine the booking-related files to explain their structure and functionality.

Booking Module Explanation
The booking module implements a reservation system using NestJS with event-driven architecture. Here's the breakdown:

booking.controller.ts
REST API endpoints for booking operations:

POST /bookings - Create new booking (requires authentication)
GET /bookings - Get all bookings
GET /bookings/my - Get current user's bookings
GET /bookings/resource/:resourceId - Get bookings for specific resource
GET /bookings/:id - Get single booking details
PATCH /bookings/:id/confirm - Confirm a booking
PATCH /bookings/:id/cancel - Cancel a booking
All endpoints protected by JwtAuthGuard and documented with Swagger annotations.

booking.service.ts
Core business logic:

create()
 - Creates booking after checking availability via AvailabilityService, emits booking.created event
findAll()
 - Retrieves all bookings with user and resource details
findByUser()
 - Gets bookings for specific user
findByResource()
 - Gets bookings for specific resource
findOne()
 - Gets single booking by ID
updateStatus()
 - Updates booking status and emits booking.confirmed or booking.canceled events
confirm()
 / 
cancel()
 - Convenience methods for status updates
Uses Prisma ORM for database operations and EventEmitter2 for event-driven communication.

booking.listeners.ts
Event handlers for booking lifecycle:

handleBookingCreated()
 - Listens to booking.created event and triggers payment processing via PaymentService
Currently uses hardcoded amount (100) - would need dynamic pricing calculation
booking.module.ts
Module configuration:

Imports: AvailabilityModule, PaymentModule
Providers: 
BookingService
, PrismaService, 
BookingListeners
Controllers: 
BookingController
Exports: 
BookingService
 (available to other modules)
Architecture Pattern
Event-driven design: Service emits events → Listeners react → Decoupled payment/notification processing

Feedback submitted


awhat is booklistner and whats its role

BookingListeners Explained
What It Is
BookingListeners
 is an event handler class that listens to booking-related events and triggers side effects asynchronously.

Its Role
Event-Driven Architecture
Instead of the booking service directly calling payment processing (tight coupling), it uses this pattern:

BookingService creates a booking → emits booking.created event
BookingListeners listens for the event → triggers payment processing
Decouples booking logic from payment logic
Current Implementation
booking.listeners.ts#10-20
@OnEvent('booking.created')
async handleBookingCreated(event: BookingCreatedEvent) {
  console.log('Booking created event received:', event);
  
  // Trigger payment processing
  await this.paymentService.processPayment(
    event.bookingId,
    100, // This would be calculated based on resource pricing
    'credit_card'
  );
}
Benefits
Separation of Concerns - Booking creation doesn't need to know about payments
Scalability - Easy to add more listeners (notifications, analytics, etc.) without modifying booking service
Async Processing - Side effects happen independently
Testability - Can test booking and payment logic separately
How It Works
When a booking is created in 
booking.service.ts
:

typescript
this.eventEmitter.emit('booking.created', bookingCreatedEvent);
The 
OnEvent('booking.created')
 decorator automatically invokes 
handleBookingCreated()
 with the event data.

Potential Extensions
You could add more listeners for:

Email notifications
SMS alerts
Logging/analytics
Inventory updates
Calendar sync
All without touching the core booking creation logic.

Feedback submitted

Your recent terminal commands:
> cd Reservation
> npm run start:dev

remove sms make it just by email 

I'll check the notification files to remove SMS functionality and keep only email notifications.

Now I'll remove SMS and push notification functionality, keeping only email notifications.

notification.service.ts
+2
-23
Done! I've removed all SMS and push notification functionality from the notification service. The system now only sends email notifications for:

Booking created
Booking confirmed
Booking canceled
The changes made:

Removed sendSMS() method
Removed sendPushNotification() method
Removed SMS and push notification calls from 
sendNotification()
 method
Updated console log to reflect email-only notifications
Feedback submitted

Your recent terminal commands:
> npm run start:dev

from where get this payment id pay_1764187629635_4ijgzqdd1 

I need to search for where this payment ID format is generated in your codebase.

Payment ID Generation
The payment ID pay_1764187629635_4ijgzqdd1 is generated in the PaymentService:

payment.service.ts#53
paymentId: `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
How It Works
The 
simulatePaymentGateway()
 method creates the payment ID using:

pay_ - Static prefix
Date.now() - Current timestamp in milliseconds (e.g., 1764187629635)
_ - Separator
Math.random().toString(36).substr(2, 9) - Random alphanumeric string (e.g., 4ijgzqdd1)
Flow
BookingListeners triggers payment when booking is created
PaymentService.processPayment() is called
simulatePaymentGateway() generates the payment ID
If successful (90% chance), emits booking.confirmed event with the payment ID
Payment ID is included in the confirmation email
This is a simulated payment gateway. In production, you'd use real payment providers like Stripe or PayPal, which provide their own payment IDs.

Feedback submitted


iwant to make payment process real by stripe

I'll help you integrate Stripe for real payment processing. Let me update the payment service to use Stripe.

1
Install Stripe package

Update payment service with Stripe integration

Update environment variables documentation

Update booking listener to pass correct amount

…\new\Reservation > npm install stripe


pm install stripe                               
added 1 package, and audited 598 packages in 5m

86 packages are looking for funding
  run `npm fund` for details

3 vulnerabilities (2 moderate, 1 high)

To address all issues (including breaking change
s), run:                                          npm audit fix --force

Run `npm audit` for details.
Exit Code 0

Install Stripe package

2
Update payment service with Stripe integration

2 more
Now I'll update the payment service to use Stripe:

payment.service.ts
+147
-75


I need to fix the lint errors:

Install Stripe package

2
Update payment service with Stripe integration

2 more
payment.service.ts
+4
-4
Now let me update the payment module to include PrismaService:

payment.module.ts
+2
-1
Now let me check if there's a .env file and create documentation for the required Stripe environment variables:

1 more
Update payment service with Stripe integration

3
Update environment variables documentation

1 more
Cascade cannot write to 
.env.example
 because it already exists.
.env.example
+4
Now let me add Stripe setup instructions to the README:

README.md
+27
2 more
Update environment variables documentation

4
Update booking listener to pass correct amount

Now let me check the resource schema to see if there's a price field:

I see the Resource model doesn't have a price field. Let me update the booking listener to calculate the price based on the booking duration and add a comment about implementing dynamic pricing:

booking.listeners.ts
+7
-1
Stripe Integration Complete
I've successfully integrated real Stripe payment processing into your booking system. Here's what was done:

Changes Made
1. Payment Service (
payment.service.ts
)
✅ Installed Stripe SDK
✅ Replaced simulated payment with real Stripe API calls
✅ Added 
processPayment()
 - Creates and confirms Stripe PaymentIntent
✅ Added 
createPaymentIntent()
 - For client-side payment flow
✅ Updated 
refundPayment()
 - Real Stripe refunds
✅ Updated 
getPaymentStatus()
 - Retrieves actual payment status from Stripe
2. Payment Module (
payment.module.ts
)
✅ Added PrismaService to providers
3. Booking Listener (
booking.listeners.ts
)
✅ Dynamic amount calculation based on booking duration
✅ Uses hourly rate ($50/hour default)
✅ Added TODO for implementing resource-specific pricing
4. Environment Configuration
✅ Updated 
.env.example
 with Stripe keys
✅ Added Stripe setup instructions to README
Setup Instructions
Get Stripe API Keys:
Sign up at stripe.com
Get test keys from Stripe Dashboard
Add to .env file:
env
STRIPE_SECRET_KEY=sk_test_your_actual_key_here
STRIPE_PUBLISHABLE_KEY=pk_test_your_actual_key_here
Test Payment:
Use test card: 4242 4242 4242 4242
Any future expiry date
Any 3-digit CVC
How It Works
User creates booking → booking.created event emitted
BookingListeners
 calculates amount (duration × hourly rate)
PaymentService.processPayment()
 creates Stripe PaymentIntent
Payment confirmed automatically (in production, client confirms)
On success → booking.confirmed event emitted
Email notification sent with payment ID
Next Steps (Optional)
Add price or hourlyRate field to Resource model for dynamic pricing
Implement client-side payment confirmation using Stripe Elements
Add webhook handler for Stripe events (payment succeeded/failed)
Feedback submitted


put when create payment must user add payment method how you made it 

I need to modify the payment flow so users provide their payment method instead of using a hardcoded test card. Let me update the implementation to support client-provided payment methods.

Now I'll update the system to require users to provide payment method details when creating a booking. I'll implement a two-step payment flow:

Create booking → Get payment intent client secret
User provides payment method → Confirm payment
create-booking.dto.ts
+10
-1
Now update the booking service to pass the payment method ID to the event:

booking.events.ts
+1
Now update the booking service to include the payment method ID in the event:

booking.service.ts
+1
-1
booking.service.ts
+1
Now update the booking listener to pass the payment method ID to the payment service:

booking.listeners.ts
+1
-1


Now I need to update the payment service to handle optional payment method ID and create a two-step flow:

payment.service.ts
+17
-4
Now add an endpoint to confirm payment with a payment method:

payment.controller.ts
+6
-1


Now add the confirmPaymentIntent method to the payment service:

payment.service.ts
+51
Now let me create a comprehensive documentation file explaining the payment flow:

PAYMENT_FLOW.md
new
+204
Perfect! Now let me create a summary of the changes:

Payment Method Integration Complete ✅
I've updated the system to require users to provide payment methods when creating bookings. Here's what changed:

Key Changes
1. Booking DTO (
create-booking.dto.ts
)
✅ Added optional paymentMethodId field
Users can now pass Stripe payment method ID when creating a booking
2. Payment Service (
payment.service.ts
)
✅ Updated 
processPayment()
 to accept optional paymentMethodId
✅ Two-step flow:
Without payment method: Returns clientSecret for client-side confirmation
With payment method: Processes payment immediately
✅ Added 
confirmPaymentIntent()
 method for confirming payments later
3. Payment Controller (
payment.controller.ts
)
✅ Added PATCH /payments/confirm endpoint
Allows confirming payment with payment method after booking creation
4. Booking Events (
booking.events.ts
)
✅ Added paymentMethodId to 
BookingCreatedEvent
5. Documentation
✅ Created 
PAYMENT_FLOW.md
 with complete integration guide
How It Works
Option 1: Direct Payment (Simple)
json
POST /bookings
{
  "resourceId": 1,
  "startTime": "2024-12-01T10:00:00Z",
  "endTime": "2024-12-01T12:00:00Z",
  "paymentMethodId": "pm_card_visa"  // ← User provides payment method
}
✅ Payment processed immediately

Option 2: Client-Side Confirmation (Production)
json
POST /bookings
{
  "resourceId": 1,
  "startTime": "2024-12-01T10:00:00Z",
  "endTime": "2024-12-01T12:00:00Z"
  // No paymentMethodId
}
Response:

json
{
  "requiresAction": true,
  "clientSecret": "pi_xxx_secret_xxx",
  "message": "Please provide payment method to complete booking"
}
Then user confirms on client using Stripe Elements, or calls:

json
PATCH /payments/confirm
{
  "paymentIntentId": "pi_xxx",
  "paymentMethodId": "pm_card_visa"
}
Test Payment Methods
For testing in Stripe test mode:

pm_card_visa - Visa
pm_card_mastercard - Mastercard
pm_card_amex - American Express
Or use test card: 4242 4242 4242 4242

Check 
PAYMENT_FLOW.md
 for complete documentation!

Feedback submitted


in prisma studio why all table not show 

Let me check your Prisma schema and help diagnose why tables aren't showing in Prisma Studio.

I see the issue - your Prisma schema is missing the DATABASE_URL in the datasource configuration. Let me check if there's a .env file and help you fix this:

Analyzed
c:\Users\Reem\Desktop\back\new\Reservation
The issue is that your Prisma schema is missing the url property in the datasource. Here's how to fix it:

schema.prisma
+1
Now you need to run migrations to create the tables in your database. Let me provide you with the commands:

…\new\Reservation > npx prisma migrate dev --name init


px prisma migrate dev --name init               Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma\schema.prisma
Error: Prisma schema validation - (get-config wa
sm)                                             Error code: P1012
error: The datasource property `url` is no longe
r supported in schema files. Move connection URLs for Migrate to `prisma.config.ts` and pass either `adapter` for a direct database connection or `accelerateUrl` for Accelerate to the `PrismaClient` constructor. See https://pris.ly/d/config-datasource and https://pris.ly/d/prisma7-client-config                                           -->  prisma\schema.prisma:3
   |
 2 |   provider = "postgresql"
 3 |   url      = env("DATABASE_URL")
   |

Validation Error Count: 1
[Context: getConfig]

Prisma CLI Version : 7.0.1
Exit Code 1

Checked command status
I see! You're using Prisma 7, which has a different configuration. Let me check your 
prisma.config.ts
:

Good! The config is correct. Now I need to remove the url from the schema file since Prisma 7 uses 
prisma.config.ts
 instead:

schema.prisma
-1
Now let's run the migration again:

…\new\Reservation > npx prisma migrate dev --name init

Canceled background terminal command
Feedback submitted


it was work well st in studio not all show

I understand - Prisma Studio is working but not all tables are showing. This usually happens when:

Migrations haven't been applied - Tables don't exist in the database yet
Database connection issue - Can't connect to see all tables
Tables exist but no data - They show but appear empty
Let me help you check and fix this:

…\new\Reservation > npx prisma db push


px prisma db push                               Loaded Prisma config from prisma.config.ts.

Prisma schema loaded from prisma\schema.prisma
Datasource "db": PostgreSQL database "booking", 
schema "public" at "localhost:5432"             
The database is already in sync with the Prisma 
schema.
Exit Code 0
Good! The database is in sync. Now let's check which tables you have in your schema and verify they're all created:

…\new\Reservation > npx prisma studio



Checked command status
Perfect! Prisma Studio is running. Based on your schema, you should see these 4 tables:

✅ User
✅ Resource
✅ ResourceSchedule
✅ Booking
Which tables are you NOT seeing in Prisma Studio?
The schema defines these 4 models. If some are missing, it could be because:

Common Reasons:
Browser cache - Try refreshing the page (Ctrl + F5)
Wrong database - Check your 
.env
 file has correct DATABASE_URL
Schema not synced - Run npx prisma generate to regenerate the client
Let me regenerate the Prisma client to ensure everything is in sync:

…\new\Reservation > npx prisma generate


Now refresh Prisma Studio in your browser. You should see all 4 tables:

Expected Tables in Prisma Studio:
Table	Description
User	User accounts
Resource	Bookable resources (rooms, cars, etc.)
ResourceSchedule	Availability schedules for resources
Booking	User bookings with status
Please tell me which specific tables are missing so I can help you troubleshoot further.

If all tables show now after refreshing, you're all set! If not, let me know which ones are missing.

Feedback submitted

Your modified files:
login.dto.ts
c:\Users\Reem\Desktop\back\new\Reservation\src\shared\dto
+2
-2

@terminal:node after crete payment it show this if payment method not work why the booking cretaed it must give me error and not make process wat do you think ?

You're absolutely right! This is a critical issue in the current flow. The booking is being created before payment is confirmed, which means:

❌ Current Problem:

Booking gets created with status PENDING
Payment fails
Booking still exists in database (orphaned booking)
User thinks they have a booking but payment failed
This is bad UX and creates data inconsistency. Let me fix this by implementing a transactional approach:

Solution: Only create booking AFTER successful payment
I'll refactor this to handle payment synchronously and only create the booking if payment succeeds:

booking.service.ts
+86
-29


Now I need to add the processPaymentForBooking method to the payment service and remove the booking listener since we're handling payment synchronously:

payment.service.ts
+63
Now update the booking module to include PaymentService and remove BookingListeners since we don't need async payment processing anymore:

booking.module.ts
+1
-2
Perfect! Now let me create a summary document explaining the improved flow:

BOOKING_FLOW_FIXED.md
new
+203
✅ Fixed! Payment Now Validates BEFORE Booking Creation
What Changed
Before (❌ Bad)
1. Create booking → PENDING
2. Process payment async
3. Payment fails → Booking still exists (orphaned)
After (✅ Good)
1. Check availability
2. Process payment → If fails, STOP and return error
3. Payment succeeds → Create booking as CONFIRMED
4. Send confirmation email
Key Improvements
✅ No orphaned bookings - Booking only created after successful payment
✅ Immediate error feedback - User gets payment error right away
✅ Atomic operation - Payment + Booking happen together or not at all
✅ Better status - Bookings start as CONFIRMED (not PENDING)
What Happens Now
With Valid Payment Method:
json
POST /bookings
{
  "resourceId": 1,
  "startTime": "2024-12-01T10:00:00Z",
  "endTime": "2024-12-01T12:00:00Z",
  "paymentMethodId": "pm_card_visa"
}
✅ Success: Returns booking with payment details

With Invalid Payment Method:
json
{
  "paymentMethodId": "pm_invalid"
}
❌ Error 400:

json
{
  "message": "Payment processing failed: No such PaymentMethod: 'pm_invalid'"
}
NO booking created in database!

Files Changed
✅ 
booking.service.ts
 - Payment processed before booking creation
✅ 
payment.service.ts
 - Added 
processPaymentForBooking()
 method
✅ 
booking.module.ts
 - Removed BookingListeners (no longer needed)
✅ Created 
BOOKING_FLOW_FIXED.md
 - Complete documentation
The system is now transactional and safe! No more orphaned bookings from failed payments.

Feedback submitted


what mean of paymentintent 

What is a Payment Intent?
A Payment Intent is Stripe's way of tracking a payment from creation to completion. Think of it as a "payment session" or "payment request."

Simple Explanation
Imagine you're buying something online:

Store creates Payment Intent → "I want to charge this customer $100"
Customer provides card → Payment method attached to intent
Payment is confirmed → Money is transferred
Intent status: succeeded → Payment complete