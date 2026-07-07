# Action needed in Business Central — Vendor registration submit

**Summary:** Customer registration works; **vendor registration cannot be submitted**
because of how the `vendRegIntake` API is published. This needs a change in
**Business Central** — it cannot be fixed in the registration-api backend.

## What the backend does (correct, no change needed)

For a vendor submission the backend calls the bound action exactly as published:

```
POST /v2.0/{env}/api/regPortal/regPortal/v2.0/companies({id})/vendRegIntake('<seed>')/Microsoft.NAV.submit
Body: { "payload": "<registration JSON>" }
```

The customer equivalent (`custRegIntake('<seed>')/submit`) works and creates the
registration + contacts + banks + attachments. The vendor code path is identical.

## The problem

The `submit` action is a **bound** action (`IsBound="true"`, binds to a
`vendRegIntake` record). To invoke it, an existing `vendRegIntake` record must be
used as the URL key (`'<seed>'`).

- `vendRegIntake` currently has **0 records**.
- The `vendRegIntake` API page **does not allow insert** — `POST` returns
  `405 Entity does not support insert`.
- There is **no other writable vendor entity** in the `regPortal` API.

So the **first** vendor registration can never be created: there is no seed record,
and no way to create one through the API. (Customer works only because its table
already contains a seed record, `PRG-000014`.)

Verified live:
```
vendRegIntake rows            : 0
submit action                 : bound (Microsoft.NAV.vendRegIntake)
POST insert into vendRegIntake: 405 Entity does not support insert
regPortal writable vendor set : none (only vendRegIntake, custRegIntake)
```

## Fix — choose one (in Business Central)

### Option A — Seed one vendor record (quick, unblocks immediately)
Ensure the table behind `vendRegIntake` has **at least one record**, exactly like
the customer table already has (`PRG-000014`). For example, insert one Draft row via
an install/upgrade codeunit, a configuration package, or the BC client. Once one
record exists, the bound `submit` action can be invoked and every vendor submission
will work — no backend change required.

### Option B — Remove the seed dependency (better long-term)
Publish the vendor (and customer) submit so it does **not** require a pre-existing
record. Options:
- Allow the `vendRegIntake` / `custRegIntake` API pages to be **insertable**, so the
  client can create the row and then call `submit` on it, **or**
- Expose `submit` as an **unbound / collection-level** action (e.g. bound to an
  always-present entity such as a setup singleton), so the first submission has
  something to bind to.

This also removes the same fragility on the customer side (today, deleting all
`custRegIntake` records would break customer registration in the same way).

## After the BC change
No code change is needed on the backend for Option A. The backend already:
- targets `regPortal/regPortal/v2.0`,
- calls `custRegIntake` for customers and `vendRegIntake` for vendors,
- maps the form's email to `customerEmail` / `vendorEmail`.

Just retest the vendor form — it will submit successfully.
