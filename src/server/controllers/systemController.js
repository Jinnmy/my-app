const { exec } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');
const UserModel = require('../models/userModel');
let electronApp = null;

const setElectronApp = (app) => {
    electronApp = app;
};

const runPowerShell = (command) => {
    return new Promise((resolve, reject) => {
        const tempFilePath = path.join(os.tmpdir(), `ps_script_${Date.now()}_${Math.random().toString(36).substring(7)}.ps1`);

        fs.writeFile(tempFilePath, command, (writeErr) => {
            if (writeErr) {
                return reject(new Error(`Failed to write temp PowerShell script: ${writeErr.message}`));
            }

            const psCommand = `powershell -NoProfile -ExecutionPolicy Bypass -File "${tempFilePath}"`;

            exec(psCommand, { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
                // Cleanup temp file
                fs.unlink(tempFilePath, (unlinkErr) => {
                    if (unlinkErr) console.warn(`Failed to delete temp file: ${unlinkErr.message}`);
                });

                console.log('STDOUT:', stdout);
                console.log('STDERR:', stderr);
                if (error) console.error(error);

                if (error) {
                    reject(new Error(stderr || error.message));
                } else {
                    resolve(stdout.trim());
                }
            });
        });
    });
};

const systemController = {
    getDisks: async (req, res) => {
        console.log('getDisks called');
        const platform = os.platform();
        if (platform === 'win32') {
            try {
                // Fetch all physical disks and check if they are boot disks
                const cmd = `
                    $ErrorActionPreference = 'Stop'
                    try {
                        $bootDisks = Get-Disk | Where-Object IsBoot | Select-Object -ExpandProperty Number
                        $pDisks = Get-PhysicalDisk | Select-Object DeviceId, FriendlyName, CanPool, Size, HealthStatus, @{N='MediaType';E={$_.MediaType.ToString().Trim()}}
                        $lDisks = Get-Disk | Select-Object Number, FriendlyName, Size, IsBoot

                        $result = @()

                        # 1. Process Logical Disks (Get-Disk) - These are usable volumes/disks
                        foreach ($l in $lDisks) {
                            $idStr = $l.Number.ToString()
                            $p = $pDisks | Where-Object { $_.DeviceId -eq $idStr }
                            
                            $canPool = $false
                            $mediaType = "Virtual"
                            $healthStatus = "Unknown"
                            $name = $l.FriendlyName
                            $size = $l.Size
                            
                            if ($p) {
                                $canPool = $p.CanPool
                                $mediaType = $p.MediaType
                                $healthStatus = $p.HealthStatus
                            }

                            $result += [PSCustomObject]@{
                                DeviceId = $idStr
                                FriendlyName = $name
                                CanPool = $canPool
                                Size = $size
                                MediaType = $mediaType
                                HealthStatus = $healthStatus
                                IsBoot = $l.IsBoot
                            }
                        }

                        # 2. Process Physical Disks that are CanPool=True but might be missing from Logical Disks (e.g. raw/offline)
                        foreach ($p in $pDisks) {
                            $existing = $result | Where-Object { $_.DeviceId -eq $p.DeviceId }
                            if (-not $existing -and $p.CanPool) {
                                $result += [PSCustomObject]@{
                                    DeviceId = $p.DeviceId
                                    FriendlyName = $p.FriendlyName
                                    CanPool = $true
                                    Size = $p.Size
                                    MediaType = $p.MediaType
                                    HealthStatus = $p.HealthStatus
                                    IsBoot = $false
                                }
                            }
                        }

                        $result | ConvertTo-Json -Compress
                    } catch {
                        Write-Error $_
                    }
                `;
                console.log('Executing PowerShell command for disks...');
                const output = await runPowerShell(cmd);
                console.log('PowerShell Output:', output);

                let disks = [];
                if (output) {
                    try {
                        const parsed = JSON.parse(output);
                        disks = Array.isArray(parsed) ? parsed : [parsed];
                    } catch (e) {
                        console.error('JSON Parse Error:', e);
                    }
                }

                const mappedDisks = disks.map(d => ({
                    device: d.DeviceId,
                    name: d.FriendlyName,
                    size: d.Size,
                    freeSpace: d.CanPool ? d.Size : 0,
                    canPool: d.CanPool,
                    mediaType: d.MediaType,
                    healthStatus: d.HealthStatus,
                    isBoot: d.IsBoot
                }));

                res.json(mappedDisks);
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        } else {
            // Mock for non-windows
            res.json([
                { device: '/dev/sda1', size: 100000000000, freeSpace: 50000000000, name: 'Main Disk', canPool: true, isBoot: false, healthStatus: 'Healthy' },
                { device: '/dev/sda2', size: 500000000000, freeSpace: 0, name: 'System Disk', canPool: false, isBoot: true, healthStatus: 'Healthy' }
            ]);
        }
    },

    setStartup: (req, res) => {
        const { enable } = req.body;

        if (electronApp) {
            try {
                electronApp.setLoginItemSettings({
                    openAtLogin: enable,
                    path: process.execPath
                });
                res.json({ success: true, message: `Startup set to ${enable}` });
            } catch (error) {
                res.status(500).json({ error: 'Failed to set startup settings: ' + error.message });
            }
        } else {
            res.status(503).json({ error: 'Electron app instance not available' });
        }
    },

    saveStorageConfig: async (req, res) => {
        // Check for Admin privileges
        if (os.platform() === 'win32') {
            try {
                await runPowerShell('net session');
            } catch (e) {
                return res.status(403).json({ error: 'Administrator privileges required. Please restart the application as Administrator.' });
            }
        }

        const { disks, raidLevel } = req.body;
        let configPath = path.join(__dirname, '../config/storage.json');

        if (electronApp && electronApp.isPackaged) { // Use electronApp reference to check if we should use userData
            configPath = path.join(electronApp.getPath('userData'), 'storage.json');
        }

        try {
            if (os.platform() === 'win32' && disks && disks.length > 0) {
                let psScript = '';

                if (raidLevel === 'existing') {
                    // Handle existing disk (no formatting)
                    const diskId = disks[0]; // Assume single disk for existing mode
                    console.log(`Using existing disk: ${diskId}`);

                    psScript = `
                        $ErrorActionPreference = 'Stop'
                        try {
                            $diskId = "${diskId}"
                            # Find partition with a drive letter on this disk
                            $partition = Get-Partition -DiskNumber $diskId | Where-Object { $_.DriveLetter -ne 0 -and $_.DriveLetter -ne $null } | Select-Object -First 1
                            
                            if ($partition) {
                                Write-Host "VOLUME_PATH: $($partition.DriveLetter):\"
                                Write-Host "Existing Volume Identified Successfully."
                            } else {
                                throw "No active partition with a drive letter found on disk $diskId"
                            }
                        } catch {
                            Write-Error "Failed to identify existing volume: $_"
                            exit 1
                        }
                    `;
                } else {
                    // Handle RAID creation
                    const raidMap = {
                        '0': 'Simple',
                        '1': 'Mirror',
                        '5': 'Parity',
                        'JBOD': 'Simple'
                    };
                    const resiliency = raidMap[raidLevel] || 'Simple';
                    console.log(`Configuring RAID ${raidLevel} (${resiliency}) on disks: ${disks.join(', ')}`);

                    const poolName = "NASPool";
                    const diskIds = disks.join(', ');

                    psScript = `
                        $ErrorActionPreference = 'Stop'
                        try {
                            $diskIds = @(${diskIds})
                            Write-Host "Target Disk IDs: $diskIds"

                            $disks = Get-PhysicalDisk | Where-Object DeviceId -in $diskIds
                            
                            if (-not $disks) {
                                throw "No physical disks found with IDs: $diskIds"
                            }

                            # Attempt to clear disks if they are not poolable (best effort)
                            foreach ($d in $disks) {
                                if ($d.CanPool -eq $false) {
                                    Write-Host "Clearing disk $($d.DeviceId)..."
                                    try {
                                        Clear-Disk -InputObject $d -RemoveData -RemoveOEM -Confirm:$false -ErrorAction Stop
                                    } catch {
                                        Write-Warning "Could not clear disk $($d.DeviceId): $_"
                                    }
                                }
                            }
                            
                            # Wait for system to update
                            Start-Sleep -Seconds 2
                            
                            # Verify disks are poolable
                            $disks = Get-PhysicalDisk | Where-Object DeviceId -in $diskIds
                            $nonPoolable = $disks | Where-Object CanPool -eq $false
                            if ($nonPoolable) {
                                Write-Warning "The following disks are still not marked as CanPool: $($nonPoolable.DeviceId -join ', '). Attempting to proceed anyway..."
                            }

                            # Check if pool already exists
                            $existingPool = Get-StoragePool -FriendlyName "${poolName}" -ErrorAction SilentlyContinue
                            if ($existingPool) {
                                Write-Host "Pool '${poolName}' already exists. Removing..."
                                Remove-StoragePool -InputObject $existingPool -Confirm:$false
                                Start-Sleep -Seconds 2
                            }

                            # Create Pool
                            Write-Host "Creating Storage Pool '${poolName}'..."
                            $pool = New-StoragePool -FriendlyName "${poolName}" -StorageSubsystemFriendlyName "Windows Storage*" -PhysicalDisks $disks
                            
                            if ($pool) {
                                Write-Host "Creating Virtual Disk..."
                                $vdisk = New-VirtualDisk -StoragePoolFriendlyName "${poolName}" -FriendlyName "NASDisk" -ResiliencySettingName "${resiliency}" -UseMaximumSize
                                
                                if ($vdisk) {
                                    Write-Host "Initializing and Formatting..."
                                    $partition = Initialize-Disk -VirtualDisk $vdisk -PartitionStyle GPT -PassThru | New-Partition -AssignDriveLetter -UseMaximumSize
                                    $partition | Format-Volume -FileSystem NTFS -NewFileSystemLabel "NASStorage" -Confirm:$false
                                    Write-Host "VOLUME_PATH: $($partition.DriveLetter):\"
                                    Write-Host "Storage Setup Completed Successfully."
                                } else {
                                    throw "Failed to create Virtual Disk."
                                }
                            } else {
                                throw "Failed to create Storage Pool."
                            }
                        } catch {
                            Write-Error "Setup Failed: $_"
                            exit 1
                        }
                    `;
                }

                // Execute the script
                const output = await runPowerShell(psScript);
                console.log("Storage Setup Output:", output);

                // Parse volume path
                const match = output.match(/VOLUME_PATH:\s*([A-Z]:\\?)/);
                if (match && match[1]) {
                    req.body.volumePath = match[1].endsWith('\\') ? match[1] : match[1] + '\\';
                    console.log(`Detected Volume Path: ${req.body.volumePath}`);
                } else {
                    console.warn("Could not detect volume path from PowerShell output.");
                }
            }

            fs.writeFile(configPath, JSON.stringify(req.body, null, 2), (err) => {
                if (err) {
                    console.error('Error saving config:', err);
                    return res.status(500).json({ error: 'Failed to save configuration' });
                }
                console.log('Storage Config Saved to:', configPath);
                res.json({ success: true, message: 'Storage configuration saved' });
            });
        } catch (error) {
            console.error('RAID Setup Error:', error);
            res.status(500).json({ error: 'Failed to configure storage: ' + error.message });
        }
    },

    getStorageStats: async (req, res) => {
        try {
            let configPath = path.join(__dirname, '../config/storage.json');
            if (electronApp && electronApp.isPackaged) {
                configPath = path.join(electronApp.getPath('userData'), 'storage.json');
            }

            // Check if config exists
            if (!fs.existsSync(configPath)) {
                return res.json({ total: 0, free: 0, used: 0, unconfigured: true });
            }

            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            const volumePath = config.volumePath;

            if (!volumePath) {
                return res.json({ total: 0, free: 0, used: 0, unconfigured: true });
            }

            if (os.platform() === 'win32') {
                // Clean up volume path for Get-Volume (e.g., "D:\" -> "D")
                const driveLetter = volumePath.replace(':\\', '').replace(':', '');

                const cmd = `
                    $ErrorActionPreference = 'Stop'
                    try {
                        $v = Get-Volume -DriveLetter "${driveLetter}"
                        $result = @{
                            Total = $v.Size
                            Free = $v.SizeRemaining
                        }
                        $result | ConvertTo-Json
                    } catch {
                         Write-Error $_
                    }
                 `;

                const output = await runPowerShell(cmd);
                if (!output) throw new Error("No output from storage stats check");

                const stats = JSON.parse(output);
                const totalDiskSize = stats.Total;

                // Logic Update: Max Available = Total Disk - Total Allocated
                // We ignore the actual "Free" space for the purpose of LIMITS, 
                // though we still return it if needed for other UI.

                UserModel.getTotalAllocation((err, totalAllocated) => {
                    if (err) {
                        console.error('Error fetching total allocation:', err);
                        // Fallback to strict free space if db fails
                        return res.json({
                            total: totalDiskSize,
                            free: stats.Free,
                            allocated: 0,
                            available: stats.Free
                        });
                    }

                    // Available for new allocation = Total Capacity - Already Allocated
                    const availableForAllocation = totalDiskSize - (totalAllocated || 0);

                    res.json({
                        total: totalDiskSize,
                        free: stats.Free, // Actual free space on disk
                        allocated: totalAllocated || 0,
                        available: availableForAllocation > 0 ? availableForAllocation : 0
                    });
                });

            } else {
                // Mock for non-windows
                res.json({
                    total: 100000000000,
                    free: 45000000000,
                    allocated: 50000000000,
                    available: 50000000000
                });
            }

        } catch (error) {
            console.error('Error fetching storage stats:', error);
            res.status(500).json({ error: 'Failed to fetch storage stats' });
        }
    },

    factoryReset: async (req, res) => {
        try {
            console.log("Initiating Factory Reset...");

            // 1. Close Database Connection
            // We need to require db to close it, if it's exported as a singleton
            const db = require('../config/database');
            db.close((err) => {
                if (err) console.error('Error closing database:', err.message);
                else console.log('Database connection closed.');

                // 2. Delete Files
                const filesToDelete = [
                    'database.sqlite',
                    'config/storage.json',
                    'config/settings.json'
                ];

                const isPackaged = electronApp && electronApp.isPackaged;

                filesToDelete.forEach(file => {
                    // We need to be aggressive about deleting from ALL possible locations
                    // because dev/prod and 'userData' vs local can get mixed up.

                    const pathsToDelete = [];

                    // 1. Global userData path (Always check this)
                    if (electronApp) {
                        const userDataPath = electronApp.getPath('userData');
                        if (file === 'database.sqlite') {
                            pathsToDelete.push(path.join(userDataPath, 'database.sqlite'));
                        } else {
                            pathsToDelete.push(path.join(userDataPath, path.basename(file)));
                        }
                    }

                    // 2. Local Source path (Critical for Dev mode)
                    // file is like 'config/storage.json' or 'database.sqlite'
                    // __dirname is .../controllers
                    if (file === 'database.sqlite') {
                        pathsToDelete.push(path.join(__dirname, '../../', 'database.sqlite'));
                    } else {
                        // file is 'config/storage.json' -> ../config/storage.json
                        pathsToDelete.push(path.join(__dirname, '../', file));
                    }

                    pathsToDelete.forEach(p => {
                        if (fs.existsSync(p)) {
                            try {
                                fs.unlinkSync(p);
                                console.log(`Factory Reset: Successfully deleted ${p}`);
                            } catch (e) {
                                console.error(`Factory Reset: Failed to delete ${p}:`, e);
                            }
                        } else {
                            console.log(`Factory Reset: File not found at ${p} (clean)`);
                        }
                    });
                });

                // 3. Send Response & Relaunch
                res.json({ success: true, message: 'Factory reset complete. Restarting...' });

                setTimeout(() => {
                    if (electronApp) {
                        electronApp.relaunch();
                        electronApp.exit(0);
                    } else {
                        console.log('App would restart now if in Electron.');
                        process.exit(0);
                    }
                }, 1000);
            });

        } catch (error) {
            console.error('Factory Reset Error:', error);
            res.status(500).json({ error: 'Factory reset failed: ' + error.message });
        }
    }
};

module.exports = { systemController, setElectronApp };
