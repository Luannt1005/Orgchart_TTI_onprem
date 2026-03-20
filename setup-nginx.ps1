$ErrorActionPreference = "Stop"
$nginxVersion = "1.26.2"
$nginxZipUrl = "http://nginx.org/download/nginx-$nginxVersion.zip"
$nginxDir = "c:\Users\luan.nguyen\Desktop\nginx-$nginxVersion"

if (-Not (Test-Path -Path $nginxDir)) {
    Write-Host "Downloading Nginx $nginxVersion..."
    Invoke-WebRequest -Uri $nginxZipUrl -OutFile "nginx.zip"
    Write-Host "Extracting Nginx..."
    Expand-Archive -Path "nginx.zip" -DestinationPath "c:\Users\luan.nguyen\Desktop" -Force
    Remove-Item -Path "nginx.zip"
} else {
    Write-Host "Nginx already downloaded."
}

$projectNginxConf = "c:\Users\luan.nguyen\Desktop\Org postges\OrgChart_TTI_SHTP_Project_Postgres\nginx.conf"
Write-Host "Copying config..."
Copy-Item -Path $projectNginxConf -Destination "$nginxDir\conf\nginx.conf" -Force

Write-Host "Stopping any running Nginx..."
Stop-Process -Name "nginx" -ErrorAction SilentlyContinue

Write-Host "Starting Nginx..."
Push-Location -Path $nginxDir
Start-Process -FilePath "nginx.exe" -WindowStyle Hidden
Pop-Location
Write-Host "Done! Nginx should now be listening on port 80."
