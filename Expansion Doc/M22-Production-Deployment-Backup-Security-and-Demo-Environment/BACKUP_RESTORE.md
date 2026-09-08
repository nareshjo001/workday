# Backup and Restore

## Backup

From the repository root, create a database-only SQL backup through the Compose MySQL container:

```powershell
$backupPath = ./scripts/backup.ps1 -Database vms_demo -OutputDirectory backups -ComposeEnvFile .env -ProjectName workday
```

The helper validates database identifiers, writes a timestamped dump with schema/data/routines/events, fails closed on mysqldump errors, and returns the created path. Database backups do not contain environment secrets or mounted document/PDF files.

## Restore test procedure

```powershell
./scripts/restore.ps1 -BackupPath $backupPath -TargetDatabase vms_restore -ComposeEnvFile .env -ProjectName workday
```

The target must end in `_restore` or `_demo`. The helper recreates only that named target then streams the dump into it. Verify `schema_migrations`, representative users, project, assignment, approved timesheet, invoice/PDF, and payment. Start backend with `DB_NAME` set to the restore target and verify readiness and authenticated API access.

## Storage backup

Back up the `document-data` volume separately. Restore it with the matching database backup because document keys are database references. Validate authorized PDF/document operations after restoration.

## Rollback strategy

Migrations are forward-only. Before a risky migration: create and verify backup, deploy, and validate. On failure: stop rollout, restore database and storage if needed, and deploy a compatible prior application version. For an additive defect, prefer a tested forward-fix migration.
