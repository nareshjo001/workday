# Implementation

Migration 022 adds `contractor_documents`, retaining type, opaque local-storage key, filename, MIME type, size, status, expiry, reviewer, and rejection reason. Binaries remain outside MySQL. Required document types are IDENTITY, TAX, and QUALIFICATION.

Vendor upload validates PDF/PNG/JPEG signatures and a 5 MB cap. Documents start PENDING; review changes them once to VERIFIED or REJECTED, with a required rejection reason. Upload/review audit rows are transactional. PM summary access is limited to contractors assigned to the PM's projects. Production assignment validation locks document rows and requires every required document to be verified and unexpired.
