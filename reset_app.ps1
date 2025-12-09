$storageConfig = "src\server\config\storage.json"
$database = "src\database.sqlite"

Write-Host "Resetting NAS App..."

if (Test-Path $storageConfig) {
    Remove-Item $storageConfig -Force
    Write-Host "Deleted $storageConfig"
} else {
    Write-Host "$storageConfig not found"
}

if (Test-Path $database) {
    Remove-Item $database -Force
    Write-Host "Deleted $database"
} else {
    Write-Host "$database not found"
}

Write-Host "App reset complete. Please restart the Electron app to enter Setup Mode."
