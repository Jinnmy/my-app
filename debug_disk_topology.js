const { exec } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const runPowerShell = (command) => {
    return new Promise((resolve, reject) => {
        const tempFilePath = path.join(os.tmpdir(), `ps_debug_${Date.now()}.ps1`);
        fs.writeFile(tempFilePath, command, (err) => {
            if (err) return reject(err);
            exec(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tempFilePath}"`, { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
                fs.unlink(tempFilePath, () => { });
                if (error) return reject(new Error(stderr || error.message));
                resolve(stdout.trim());
            });
        });
    });
};

const cmd = `
Write-Host "--- Get-PhysicalDisk ---"
Get-PhysicalDisk | Select-Object FriendlyName, DeviceId, CanPool, Size, MediaType, UniqueId | ConvertTo-Json -Compress

Write-Host "\n--- Get-Disk ---"
Get-Disk | Select-Object Number, FriendlyName, Size, IsBoot, IsSystem, IsOffline, UniqueId | ConvertTo-Json -Compress

Write-Host "\n--- Get-VirtualDisk ---"
Get-VirtualDisk | Select-Object FriendlyName, Size, HealthStatus, OperationalStatus, UniqueId | ConvertTo-Json -Compress

Write-Host "\n--- Get-StoragePool ---"
Get-StoragePool | Select-Object FriendlyName, OperationalStatus, HealthStatus, IsPrimordial | ConvertTo-Json -Compress
`;

runPowerShell(cmd).then(output => {
    console.log(output);
}).catch(err => {
    console.error('PowerShell Error:', err);
});
