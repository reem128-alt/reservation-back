# Resource Type API Documentation

## Overview

The ResourceType table allows you to define predefined types for resources. When creating a resource, you select from existing resource types instead of entering free text.

---

## Database Schema

### ResourceType Table

| Field | Type | Description |
|-------|------|-------------|
| `id` | Int | Primary key (auto-increment) |
| `name` | String | Unique identifier (e.g., "room", "car", "table") |
| `label` | String | Display name (e.g., "Hotel Room", "Vehicle") |
| `description` | String? | Optional description |
| `icon` | String? | Icon name or URL for UI |
| `metaSchema` | Json? | JSON schema for validating resource meta fields |
| `isActive` | Boolean | Whether this type is active (default: true) |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Last update timestamp |

### Resource Table (Updated)

| Field | Type | Description |
|-------|------|-------------|
| `id` | Int | Primary key |
| `code` | String | Unique resource code |
| `title` | String | Resource title |
| `resourceTypeId` | Int | **Foreign key to ResourceType** |
| `resourceType` | ResourceType | **Relation to ResourceType** |
| `description` | String? | Optional description |
| `capacity` | Int? | Optional capacity |
| `image` | String? | Cloudinary image URL |
| `meta` | Json? | Resource-specific metadata |

---

## ResourceType CRUD Operations

### Base URL
All endpoints are prefixed with `/resource-types`

### Authentication
All endpoints require JWT authentication via `Authorization: Bearer <token>`

---

## API Endpoints

### 1. Create Resource Type
**POST** `/resource-types`

Creates a new resource type.

**Request Body:**
```json
{
  "name": "room",
  "label": "Hotel Room",
  "description": "Bookable hotel rooms and suites",
  "icon": "bed",
  "metaSchema": {
    "type": "object",
    "properties": {
      "beds": { "type": "number" },
      "floor": { "type": "number" },
      "amenities": { "type": "array" }
    }
  },
  "isActive": true
}
```

**Response:** `201 Created`
```json
{
  "id": 1,
  "name": "room",
  "label": "Hotel Room",
  "description": "Bookable hotel rooms and suites",
  "icon": "bed",
  "metaSchema": { ... },
  "isActive": true,
  "createdAt": "2024-01-15T10:00:00Z",
  "updatedAt": "2024-01-15T10:00:00Z",
  "_count": {
    "resources": 0
  }
}
```

**Error Responses:**
- `409 Conflict` - Resource type with this name already exists
- `400 Bad Request` - Invalid data

---

### 2. Get All Resource Types
**GET** `/resource-types`

Retrieves all resource types with pagination and search.

**Query Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `search` | string | ❌ | Search in name, label, or description |
| `page` | number | ❌ | Page number (default: 1) |
| `limit` | number | ❌ | Items per page (default: 100) |

**Example:**
```
GET /resource-types?search=room&page=1&limit=10
```

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": 1,
      "name": "room",
      "label": "Hotel Room",
      "description": "Bookable hotel rooms and suites",
      "icon": "bed",
      "metaSchema": { ... },
      "isActive": true,
      "createdAt": "2024-01-15T10:00:00Z",
      "updatedAt": "2024-01-15T10:00:00Z",
      "_count": {
        "resources": 5
      }
    }
  ],
  "meta": {
    "total": 1,
    "page": 1,
    "limit": 10,
    "totalPages": 1
  }
}
```

---

### 3. Get Active Resource Types
**GET** `/resource-types/active`

Retrieves only active resource types (for dropdowns/selects).

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "name": "room",
    "label": "Hotel Room",
    "isActive": true,
    "_count": {
      "resources": 5
    }
  },
  {
    "id": 2,
    "name": "car",
    "label": "Vehicle",
    "isActive": true,
    "_count": {
      "resources": 3
    }
  }
]
```

---

### 4. Get Resource Type by ID
**GET** `/resource-types/:id`

Retrieves a specific resource type with all associated resources.

**Response:** `200 OK`
```json
{
  "id": 1,
  "name": "room",
  "label": "Hotel Room",
  "description": "Bookable hotel rooms and suites",
  "icon": "bed",
  "metaSchema": { ... },
  "isActive": true,
  "createdAt": "2024-01-15T10:00:00Z",
  "updatedAt": "2024-01-15T10:00:00Z",
  "resources": [
    {
      "id": 1,
      "code": "ROOM-101",
      "title": "Deluxe Suite",
      "resourceTypeId": 1
    }
  ],
  "_count": {
    "resources": 1
  }
}
```

**Error Response:**
- `404 Not Found` - Resource type not found

---

### 5. Get Resource Type by Name
**GET** `/resource-types/name/:name`

Retrieves a resource type by its unique name.

**Example:**
```
GET /resource-types/name/room
```

**Response:** Same as Get by ID

---

### 6. Update Resource Type
**PATCH** `/resource-types/:id`

Updates an existing resource type.

**Request Body:** (all fields optional)
```json
{
  "label": "Premium Hotel Room",
  "description": "Updated description",
  "isActive": false
}
```

**Response:** `200 OK`
```json
{
  "id": 1,
  "name": "room",
  "label": "Premium Hotel Room",
  "description": "Updated description",
  "isActive": false,
  "updatedAt": "2024-01-15T11:00:00Z",
  ...
}
```

**Error Responses:**
- `404 Not Found` - Resource type not found
- `409 Conflict` - Name already exists (if changing name)

---

### 7. Delete Resource Type
**DELETE** `/resource-types/:id`

Deletes a resource type. **Cannot delete if resources are associated with it.**

**Response:** `200 OK`
```json
{
  "id": 1,
  "name": "room",
  "label": "Hotel Room",
  ...
}
```

**Error Responses:**
- `404 Not Found` - Resource type not found
- `409 Conflict` - Cannot delete because resources are using this type

---

## Updated Resource Endpoints

### Creating a Resource (Updated)

**POST** `/resources`

Now requires `resourceTypeId` instead of `type` string.

**Request Body:**
```json
{
  "code": "ROOM-101",
  "title": "Deluxe Suite",
  "resourceTypeId": 1,
  "description": "Spacious room with ocean view",
  "capacity": 2,
  "image": "https://cloudinary.com/...",
  "meta": {
    "beds": 1,
    "floor": 10,
    "amenities": ["wifi", "tv", "minibar"]
  }
}
```

**Response includes resourceType:**
```json
{
  "id": 1,
  "code": "ROOM-101",
  "title": "Deluxe Suite",
  "resourceTypeId": 1,
  "resourceType": {
    "id": 1,
    "name": "room",
    "label": "Hotel Room",
    "icon": "bed"
  },
  "description": "Spacious room with ocean view",
  "capacity": 2,
  ...
}
```

---

## Workflow Example

### 1. First, create resource types:

```bash
# Create "room" type
POST /resource-types
{
  "name": "room",
  "label": "Hotel Room",
  "icon": "bed"
}

# Create "car" type
POST /resource-types
{
  "name": "car",
  "label": "Vehicle",
  "icon": "car"
}
```

### 2. Get active types for dropdown:

```bash
GET /resource-types/active
```

Returns list of active types to populate a select dropdown in your UI.

### 3. Create resources using type IDs:

```bash
POST /resources
{
  "code": "ROOM-101",
  "title": "Deluxe Suite",
  "resourceTypeId": 1  # ID from step 1
}
```

---

## Benefits

✅ **Data Consistency** - No typos in resource types  
✅ **Centralized Management** - Update type labels/icons in one place  
✅ **Validation** - Can define metaSchema for each type  
✅ **UI Friendly** - Easy to populate dropdowns with active types  
✅ **Reporting** - Better analytics by standardized types  
✅ **Scalability** - Add new types without code changes  

---

## Common Resource Types

| Name | Label | Icon | Use Case |
|------|-------|------|----------|
| `room` | Hotel Room | bed | Hotels, meeting rooms |
| `car` | Vehicle | car | Car rentals |
| `table` | Restaurant Table | utensils | Restaurant reservations |
| `doctor` | Medical Professional | stethoscope | Medical appointments |
| `equipment` | Equipment | tool | Equipment rentals |
| `court` | Sports Court | trophy | Sports facilities |
| `workspace` | Workspace | briefcase | Coworking spaces |
| `parking` | Parking Spot | parking | Parking reservations |

---

## Migration Notes

The migration automatically:
1. Creates the `ResourceType` table
2. Migrates existing `Resource.type` values to `ResourceType` entries
3. Links existing resources to their corresponding resource types
4. Removes the old `type` column from `Resource` table

All existing data is preserved during migration.
