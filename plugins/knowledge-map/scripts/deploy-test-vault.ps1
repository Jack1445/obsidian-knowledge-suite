param(
	[Parameter(Mandatory = $true)]
	[string]$TargetDirectory
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$target = [IO.Path]::GetFullPath($TargetDirectory)

if ((Split-Path -Leaf $target) -ne 'knowledge-map') {
	throw "Refusing to deploy: target directory must be named 'knowledge-map'. Received: $target"
}

$sourceManifestPath = Join-Path $projectRoot 'manifest.json'
$sourceManifest = Get-Content -Raw -LiteralPath $sourceManifestPath | ConvertFrom-Json
if ($sourceManifest.id -ne 'knowledge-map') {
	throw "Refusing to deploy: source manifest id is '$($sourceManifest.id)'."
}

$targetManifestPath = Join-Path $target 'manifest.json'
if (Test-Path -LiteralPath $targetManifestPath) {
	$targetManifest = Get-Content -Raw -LiteralPath $targetManifestPath | ConvertFrom-Json
	if ($targetManifest.id -ne 'knowledge-map') {
		throw "Refusing to overwrite plugin '$($targetManifest.id)' at $target."
	}
}

New-Item -ItemType Directory -Force -Path $target | Out-Null
foreach ($name in @('main.js', 'manifest.json', 'styles.css')) {
	Copy-Item -Force -LiteralPath (Join-Path $projectRoot $name) -Destination (Join-Path $target $name)
}

Write-Output "Knowledge Map deployed safely to $target"
