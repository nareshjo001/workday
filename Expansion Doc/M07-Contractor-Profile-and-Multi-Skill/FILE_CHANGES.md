# File changes

ADDED

- `backend/src/migrations/021_contractor_profile_multi_skill.sql` — normalized schema and safe backfill.
- `backend/src/repositories/skillRepository.js` — skill catalog and relationship persistence.
- `backend/test/integration/m07-contractor-profile.test.js` — M07 integration coverage.
- M07 documentation files in this directory.

MODIFIED

- Contractor/profile, assignment, project, vendor validation, service, repository, route, and controller modules — profile ownership, relational matching, and skill-ID compatibility.
- Contractor and Vendor frontend profile/list modules — multi-skill management and any-skill filtering.

DELETED

Deleted files: None.
