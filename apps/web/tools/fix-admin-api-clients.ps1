# Fix admin API files to use adminApiClient.
$webRoot = Split-Path -Parent $PSScriptRoot
$apiDir = Join-Path $webRoot "src\services\api"
$files = @(
    'variantStockApi.ts', 'supplierApi.ts', 'stockReceiptApi.ts', 'reviewApi.ts',
    'reportApi.ts', 'promotionApi.ts', 'pageApi.ts', 'orderApi.ts',
    'notificationApi.ts', 'menuApi.ts', 'lookbookApi.ts', 'inventoryApi.ts',
    'homepageBlocksApi.ts', 'homepageApi.ts', 'flashSaleApi.ts', 'couponApi.ts',
    'collectionApi.ts', 'categoryApi.ts', 'bannerApi.ts', 'attributeApi.ts',
    'customerApi.ts', 'adminShippingApi.ts', 'adminChatApi.ts'
)

Write-Host "Fixing admin API clients in $apiDir..." -ForegroundColor Cyan
$fixed = 0

foreach ($file in $files) {
    $path = Join-Path $apiDir $file
    if (-not (Test-Path $path)) { continue }

    $text = Get-Content $path -Raw
    if ($text -notmatch '/api/admin' -or $text -match 'adminApiClient') { continue }

    $text = $text -replace "import apiClient, \{ getErrorMessage \} from '\.\./apiClient';", "import { adminApiClient, getErrorMessage } from '../apiClient';"
    $text = $text -replace "import apiClient from '\.\./apiClient';", "import { adminApiClient } from '../apiClient';"

    $lines = $text -split "`r?`n"
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -notmatch '^import' -and $lines[$i] -match '\bapiClient\.') {
            $lines[$i] = $lines[$i] -replace '\bapiClient\.', 'adminApiClient.'
        }
    }

    ($lines -join "`n") | Set-Content $path -NoNewline
    $fixed++
}

Write-Host "Fixed $fixed files." -ForegroundColor Green
