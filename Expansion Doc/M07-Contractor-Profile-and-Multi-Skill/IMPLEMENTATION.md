# Implementation

Migration 021 seeds a `skills` catalog, backfills legacy contractor and project-requirement skills, adds `contractor_skills`, profile fields, `project_requirements.skill_id`, indexes, and foreign keys. The legacy enum columns remain temporarily as compatibility data; relational records are authoritative for M07 matching.

`PATCH /api/contractor/profile` is contractor self-service and derives identity from JWT. It permits phone, headline, total experience, and a complete skill set. Exactly one primary skill is required when skills are supplied. Vendor-owned contractor updates can manage the corresponding business profile fields and optional internal notes. Skill replacement and audit insertion occur inside one transaction. The compatibility `PATCH /profile/skill` route remains for older clients.

Eligible-contractor reads and assignment revalidation test the normalized skill relationship. Existing assignment requirement IDs and billing snapshots are never modified when a profile changes. The profile UI manages skill chips with proficiency, experience, primary selection, loading, error, and empty states. The Vendor contractor list supports server-side any-skill filtering.
