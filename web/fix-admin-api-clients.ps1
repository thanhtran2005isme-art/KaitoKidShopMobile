# Fix all admin API files to use adminApiClient
$apiDir = "kaito-kid-react\src\services\api"
$files = @(
    'variantStockApi.ts', 'supplierApi.ts', 'stockReceiptApi.ts', 'reviewApi.ts',
    'reportApi.ts', 'promotionApi.ts', 'pageApi.ts', 'orderApi.ts',
    'notificationApi.ts', 'menuApi.ts', 'lookbookApi.ts', 'inventoryApi.ts',
    'homepageBlocksApi.ts', 'homepageApi.ts', 'flashSaleApi.ts', 'couponApi.ts',
    'collectionApi.ts', 'categoryApi.ts', 'bannerApi.ts', 'attributeApi.ts',
    'customerApi.ts', 'adminShippingApi.ts', 'adminChatApi.ts'
)

Write-Host "Fixing admin API clients..." -ForegroundColor Cyan
$fixed = 0

foreach ($file in $files) {
    $path = Join-Path $apiDir $file
    if (-not (Test-Path $path)) { continue }
    
    $content = Get-Content $path -Raw
    if ($content -notmatch '/api/admin') { continue }
    if ($content -match 'adminApiClient') { 
        Write-Host "  OK: $file" -ForegroundColor Green
        continue 
    }
    
    # Fix imports
    $content = $content -replace "import apiClient, \{ getErrorMessage \} from '\.\./apiClient';", "import { adminApiClient, getErrorMessage } from '../apiClient';"
    $content = $content -replace "import apiClient from '\.\./apiClient';", "import { adminApiClient } from '../apiClient';"
    
    # Fix usage (line by line to avoid import lines)
    $lines = $content -split "`r?`n"
    for ($i = 0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -notmatch '^import' -and $lines[$i] -match '\bapiClient\.') {
            $lines[$i] = $lines[$i] -replace '\bapiClient\.', 'adminApiClient.'
        }
    }
    $content = $lines -join "`n"
    
    $content | Set-Content $path -NoNewline
    Write-Host "  Fixed: $file" -ForegroundColor Yellow
    $fixed++
}

Write-Host "`nFixed $fixed files" -ForegroundColor Green
