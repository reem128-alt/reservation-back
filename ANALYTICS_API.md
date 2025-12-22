# Analytics API Documentation

## Overview
Comprehensive analytics API that provides project-wide statistics and metrics formatted for charts and dashboards.

## Endpoint

### GET `/analytics/summary`

**Authentication Required:** Yes (JWT Bearer Token)

**Description:** Returns complete analytics data for the entire project including bookings, revenue, users, and resource statistics.

## Response Structure

### 1. Overview
Basic project statistics:
- `totalUsers`: Total number of registered users
- `totalResources`: Total number of resources
- `totalResourceTypes`: Total number of resource types
- `totalBookings`: Total number of bookings
- `totalRevenue`: Total revenue from all payments
- `activeBookings`: Currently active confirmed bookings

### 2. Booking Analytics
Detailed booking statistics:
- `totalBookings`: Total count
- `confirmedBookings`: Confirmed count
- `pendingBookings`: Pending count
- `canceledBookings`: Canceled count
- `confirmationRate`: Percentage of confirmed bookings
- `bookingsByStatus`: Chart data (label/value pairs)
- `bookingTrend`: Daily booking trends with status breakdown

### 3. Revenue Analytics
Financial metrics:
- `totalRevenue`: Total revenue
- `averageRevenuePerBooking`: Average per paid booking
- `averageMonthlyRevenue`: Average monthly revenue
- `revenueByMonth`: Monthly revenue chart data
- `revenueByResourceType`: Revenue breakdown by resource type

### 4. User Analytics
User statistics:
- `totalUsers`: Total users
- `activeUsers`: Users with at least one booking
- `inactiveUsers`: Users without bookings
- `userRegistrationTrend`: Monthly registration chart data

### 5. Resource Type Stats
Statistics per resource type:
- `type`: Resource type name
- `label`: Display label
- `totalResources`: Number of resources
- `totalBookings`: Total bookings for this type
- `totalRevenue`: Total revenue for this type
- `utilizationRate`: Percentage of confirmed bookings

### 6. Top Resources
Two lists of top performing resources:
- `topResources`: Top 10 by booking count
- `topRevenueResources`: Top 10 by revenue

Each includes:
- Resource details (id, code, title, type)
- `bookingCount`: Number of bookings
- `totalRevenue`: Total revenue generated

## Example Usage

```bash
curl -X GET http://localhost:3000/analytics/summary \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Chart Integration

All data is formatted for easy integration with chart libraries:

### Pie/Doughnut Charts
- `bookingsByStatus`
- `revenueByResourceType`

### Line/Area Charts
- `revenueByMonth`
- `bookingTrend`
- `userRegistrationTrend`

### Bar Charts
- `topResources`
- `topRevenueResources`
- `resourceTypeStats`

## Notes
- All monetary values are rounded to 2 decimal places
- Dates are in ISO format (YYYY-MM-DD)
- Percentages are rounded to 2 decimal places
- Data is calculated in real-time from the database
