param(
  [Parameter(Mandatory = $true)][string]$BackupPath,
  [Parameter(Mandatory = $true)][string]$TargetDatabase,
  [string]$ComposeEnvFile,
  [string]$ProjectName
)
if ($TargetDatabase -notmatch '^[A-Za-z0-9_]+$' -or $TargetDatabase -notmatch '(_restore|_demo)$') { throw "Restore target must be an explicit *_restore or *_demo database." }
if (!(Test-Path -LiteralPath $BackupPath)) { throw "Backup file not found." }
$composeArgs = @('compose')
if ($ComposeEnvFile) { $composeArgs += @('--env-file', $ComposeEnvFile) }
if ($ProjectName) { $composeArgs += @('--project-name', $ProjectName) }
& docker @composeArgs exec -T mysql sh -c "mysql -uroot -p`$MYSQL_ROOT_PASSWORD -e 'DROP DATABASE IF EXISTS $TargetDatabase; CREATE DATABASE $TargetDatabase CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;'"
if ($LASTEXITCODE -ne 0) { throw "Could not prepare restore database." }
Get-Content -LiteralPath $BackupPath -Raw | & docker @composeArgs exec -T mysql sh -c "mysql -uroot -p`$MYSQL_ROOT_PASSWORD $TargetDatabase"
if ($LASTEXITCODE -ne 0) { throw "Restore failed." }
