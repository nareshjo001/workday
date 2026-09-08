param(
  [Parameter(Mandatory = $true)][string]$Database,
  [string]$OutputDirectory = "backups",
  [string]$ComposeEnvFile,
  [string]$ProjectName
)
if ($Database -notmatch '^[A-Za-z0-9_]+$') { throw "Database name may contain only letters, numbers, and underscores." }
New-Item -ItemType Directory -Force -Path $OutputDirectory | Out-Null
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$target = Join-Path $OutputDirectory "$Database-$stamp.sql"
$errorPath = "$target.stderr"
$composeArgs = @('compose')
if ($ComposeEnvFile) { $composeArgs += @('--env-file', $ComposeEnvFile) }
if ($ProjectName) { $composeArgs += @('--project-name', $ProjectName) }
# Invoke Docker directly so PowerShell preserves the `sh -c` command as one
# argument. Start-Process flattens this argument list on Windows, which made
# mysqldump fail without a useful error stream.
& docker @composeArgs exec -T mysql sh -c "exec mysqldump -uroot -p`$MYSQL_ROOT_PASSWORD --single-transaction --routines --events $Database" 1> $target 2> $errorPath
if ($LASTEXITCODE -ne 0) { throw "Backup failed; inspect $errorPath" }
Remove-Item -LiteralPath $errorPath -ErrorAction SilentlyContinue
Write-Output $target
