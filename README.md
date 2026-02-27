# Identity Reconciliation Service

This project implements an **Identity Reconciliation API** that consolidates multiple identifiers (email and phone number) into a **single primary identity**, while safely linking additional identifiers as secondary records.

The service is designed to be **deterministic, idempotent, and scalable**, ensuring that repeated requests do not corrupt identity data.

---

## Problem Overview

Users may interact with a system using different identifiers over time (email, phone number, etc.).  
The goal is to **identify and unify these identifiers** so that all related data maps to **one primary identity**.

Key requirements:

- Only **one primary identity** per user
- New identifiers should be linked as **secondary**
- Conflicting identities must be **merged deterministically**
- The API must be **idempotent**

---

## Solution Approach

The service follows a **single canonical flow** for every request:

1. Validate input (email and/or phone number)
2. Fetch all matching contacts from the database
3. If no match exists → create a **primary contact**
4. If matches exist:
   - Resolve the **primary contact** (oldest by `created_at`)
   - Merge multiple primaries if necessary
   - Insert a **secondary contact** only if new information is introduced
5. Return a **consolidated identity response**

This guarantees:

- No duplicate primaries
- No duplicate secondary records
- Safe identity merging
- Idempotent behavior

---

## Database Schema

```sql
CREATE TABLE contacts (
  id SERIAL PRIMARY KEY,
  email TEXT,
  phone_number TEXT,
  linked_id INTEGER,
  link_precedence TEXT CHECK (link_precedence IN ('primary', 'secondary')),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## https://backend-78jm.vercel.app/identity (Endpoint)

### Request Body

{
"email": "user@example.com",
"phone_number": "1234567890"
}

### Response Body

{
"contact": {
"primaryContactId": 1,
"emails": ["user@example.com", "alt@example.com"],
"phoneNumbers": ["1234567890"],
"secondaryContactIds": [2, 3]
}
}

## Tech Stack

Node.js

TypeScript

Express

PostgreSQL

postgres (tagged SQL client)

Supabase (hosted Postgres)
