# Fixed Booking Flow - Payment Before Booking

## Problem (Before)
❌ **Old Flow:**
1. Create booking → Status: PENDING
2. Emit event → Process payment asynchronously
3. If payment fails → Booking still exists (orphaned)
4. User has invalid booking in database

**Issues:**
- Data inconsistency
- Failed payments leave orphaned bookings
- Poor user experience
- No immediate feedback

---

## Solution (After)
✅ **New Flow:**
1. Check availability
2. **Process payment FIRST**
3. If payment fails → **Return error, NO booking created**
4. If payment succeeds → Create booking with status: CONFIRMED
5. Emit booking.confirmed event
6. Send confirmation email

**Benefits:**
- ✅ No orphaned bookings
- ✅ Immediate payment validation
- ✅ Atomic transaction (payment + booking)
- ✅ Better error handling
- ✅ Consistent data state

---

## API Usage

### Option 1: Direct Payment (With Payment Method)

**Request:**
```json
POST /bookings
{
  "resourceId": 1,
  "startTime": "2024-12-01T10:00:00Z",
  "endTime": "2024-12-01T12:00:00Z",
  "paymentMethodId": "pm_card_visa"
}
```

**Success Response (200):**
```json
{
  "id": 1,
  "userId": 1,
  "resourceId": 1,
  "startTime": "2024-12-01T10:00:00.000Z",
  "endTime": "2024-12-01T12:00:00.000Z",
  "status": "CONFIRMED",
  "createdAt": "2024-11-26T20:00:00.000Z",
  "payment": {
    "paymentId": "pi_3SXpS8QORaU0VYZk0RBT0sXg",
    "amount": 100,
    "status": "COMPLETED"
  }
}
```

**Error Response (400) - Payment Failed:**
```json
{
  "statusCode": 400,
  "message": "Payment processing failed: No such PaymentMethod: 'pm_invalid'",
  "error": "Bad Request"
}
```

**Error Response (400) - Not Available:**
```json
{
  "statusCode": 400,
  "message": "Resource is not available for the requested time slot",
  "error": "Bad Request"
}
```

---

### Option 2: Two-Step Payment (Without Payment Method)

**Step 1: Get Payment Details**
```json
POST /bookings
{
  "resourceId": 1,
  "startTime": "2024-12-01T10:00:00Z",
  "endTime": "2024-12-01T12:00:00Z"
}
```

**Response:**
```json
{
  "requiresPayment": true,
  "amount": 100,
  "message": "Please provide payment method to complete booking",
  "bookingDetails": {
    "userId": 1,
    "resourceId": 1,
    "startTime": "2024-12-01T10:00:00Z",
    "endTime": "2024-12-01T12:00:00Z"
  }
}
```

**Step 2: Complete Booking with Payment**
```json
POST /bookings
{
  "resourceId": 1,
  "startTime": "2024-12-01T10:00:00Z",
  "endTime": "2024-12-01T12:00:00Z",
  "paymentMethodId": "pm_card_visa"
}
```

---

## Test Payment Methods

Use these Stripe test payment methods:

### Valid Cards
- `pm_card_visa` - Visa (succeeds)
- `pm_card_mastercard` - Mastercard (succeeds)
- `pm_card_amex` - American Express (succeeds)

### Test Failures
- `pm_card_chargeDeclined` - Card declined
- `pm_card_insufficientFunds` - Insufficient funds
- `pm_1234567890` - Invalid payment method (will fail)

Or use test card numbers:
- **Success:** 4242 4242 4242 4242
- **Decline:** 4000 0000 0000 0002

---

## Flow Diagram

```
User Request
    ↓
Check Availability
    ↓
[Available?] → NO → Return Error (400)
    ↓ YES
Process Payment
    ↓
[Payment Success?] → NO → Return Error (400)
    ↓ YES
Create Booking (CONFIRMED)
    ↓
Emit booking.confirmed Event
    ↓
Send Email Notification
    ↓
Return Success (200)
```

---

## Key Changes

### 1. Booking Service
- ✅ Processes payment synchronously BEFORE creating booking
- ✅ Only creates booking if payment succeeds
- ✅ Sets status to CONFIRMED immediately
- ✅ Returns payment details with booking

### 2. Payment Service
- ✅ Added `processPaymentForBooking()` method
- ✅ Doesn't require booking ID (uses temp metadata)
- ✅ Returns clear success/failure status

### 3. Removed Async Processing
- ❌ Removed `BookingListeners` (no longer needed)
- ❌ No more `booking.created` event
- ✅ Direct `booking.confirmed` event only

---

## Error Handling

All errors are caught and returned immediately:

1. **Availability Error** → 400 Bad Request
2. **Payment Error** → 400 Bad Request (with Stripe error message)
3. **Resource Not Found** → 400 Bad Request
4. **Invalid Payment Method** → 400 Bad Request

**No booking is created if ANY step fails.**
