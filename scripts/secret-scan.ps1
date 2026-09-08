param([string]$RepositoryRoot = (Split-Path -Parent $PSScriptRoot))

$patterns = @(
  @{ Name = 'private key'; Regex = '-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----' },
  @{ Name = 'AWS access key'; Regex = '\b(?:AKIA|ASIA)[A-Z0-9]{16}\b' },
  @{ Name = 'GitHub token'; Regex = '\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b' },
  @{ Name = 'Slack token'; Regex = '\bxox[baprs]-[A-Za-z0-9-]{20,}\b' },
  @{ Name = 'Google API key'; Regex = '\bAIza[A-Za-z0-9_-]{35}\b' },
  @{ Name = 'OpenAI API key'; Regex = '\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b' }
)

$findings = @()
$files = & git -C $RepositoryRoot ls-files
foreach ($relativePath in $files) {
  $path = Join-Path $RepositoryRoot $relativePath
  try { $content = Get-Content -LiteralPath $path -Raw -ErrorAction Stop } catch { continue }
  foreach ($pattern in $patterns) {
    if ($content -match $pattern.Regex) { $findings += "${relativePath}: $($pattern.Name)" }
  }
}

if ($findings.Count) {
  $findings | ForEach-Object { Write-Error "Potential secret detected: $_" }
  exit 1
}

Write-Output 'secret_scan=clean tracked_files_only=true'
