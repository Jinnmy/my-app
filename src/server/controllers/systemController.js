const { exec } = require('child_process');
const os = require('os');
const fs = require('fs');
const path = require('path');
const UserModel = require('../models/userModel');
const bcrypt = require('bcryptjs');
const TransferService = require('../services/transferService');
const HardwareMonitor = require('../../../resources/hardware-monitor/monitor');
let monitorInstance = null;
let electronApp = null;

const setElectronApp = (app) => {
    electronApp = app;
};

const getElectronApp = () => electronApp;

const runPowerShell = (command, asAdmin = false) => {
    return new Promise((resolve, reject) => {
        const tempFilePath = path.join(os.tmpdir(), `ps_script_${Date.now()}_${Math.random().toString(36).substring(7)}.ps1`);

        // Paths for stdout/stderr capture when running as admin
        const tempStdout = path.join(os.tmpdir(), `ps_out_${Date.now()}.txt`);
        const tempStderr = path.join(os.tmpdir(), `ps_err_${Date.now()}.txt`);

        fs.writeFile(tempFilePath, command, (writeErr) => {
            if (writeErr) {
                return reject(new Error(`Failed to write temp PowerShell script: ${writeErr.message}`));
            }

            let psCommand;
            let wrapperScriptPath = null;

            if (asAdmin) {
                // Secondary wrapper script approach to avoid quoting hell
                wrapperScriptPath = path.join(os.tmpdir(), `ps_wrapper_${Date.now()}_${Math.random().toString(36).substring(7)}.ps1`);

                // Helper to quote paths for PowerShell single-quoted strings
                // We use single quotes in the wrapper content
                const psQuote = (s) => `'${s.replace(/'/g, "''")}'`;

                // Wrapper script content: executes the target script and redirects output
                const wrapperContent = `
$ErrorActionPreference = 'Stop'
try {
    & ${psQuote(tempFilePath)} > ${psQuote(tempStdout)} 2> ${psQuote(tempStderr)}
} catch {
    $_.ToString() | Out-File ${psQuote(tempStderr)} -Append
}
`;
                try {
                    fs.writeFileSync(wrapperScriptPath, wrapperContent);
                } catch (wrapperErr) {
                    return reject(new Error(`Failed to write wrapper script: ${wrapperErr.message}`));
                }

                // Command to launch admin PowerShell running the wrapper
                // Minimal quoting needed here: just the path to the wrapper

                const wrapperArg = psQuote(wrapperScriptPath);

                // USING ARRAY ARGUMENTS for Start-Process
                // powershell -Command "Start-Process powershell -Verb RunAs -Wait -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', 'C:\Path...'"
                psCommand = `powershell -Command "Start-Process powershell -Verb RunAs -Wait -WindowStyle Hidden -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ${wrapperArg}"`;
            } else {
                psCommand = `powershell -NoProfile -ExecutionPolicy Bypass -File "${tempFilePath}"`;
            }

            exec(psCommand, { maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
                // Determine output sources
                if (asAdmin) {
                    // Read from temp files
                    let outContent = '';
                    let errContent = '';

                    try {
                        if (fs.existsSync(tempStdout)) outContent = fs.readFileSync(tempStdout, 'utf8');
                        if (fs.existsSync(tempStderr)) errContent = fs.readFileSync(tempStderr, 'utf8');
                    } catch (readErr) {
                        console.error('Failed to read admin output files:', readErr);
                    }

                    // Cleanup temp files
                    try {
                        if (fs.existsSync(tempStdout)) fs.unlinkSync(tempStdout);
                        if (fs.existsSync(tempStderr)) fs.unlinkSync(tempStderr);
                        if (wrapperScriptPath && fs.existsSync(wrapperScriptPath)) fs.unlinkSync(wrapperScriptPath);
                    } catch (cleanupErr) {
                        console.warn('Failed to cleanup admin temp files:', cleanupErr);
                    }

                    // Use read content as stdout/stderr
                    stdout = outContent;
                    stderr = errContent;
                }

                // Cleanup script file
                fs.unlink(tempFilePath, (unlinkErr) => {
                    if (unlinkErr) console.warn(`Failed to delete temp file: ${unlinkErr.message}`);
                });

                console.log('STDOUT:', stdout);
                console.log('STDERR:', stderr);

                if (error) console.error('Exec error:', error);

                if (error || (stderr && stderr.trim().length > 0)) {
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

                // AI Health Check
                try {
                    const settingsPath = electronApp && electronApp.isPackaged
                        ? path.join(electronApp.getPath('userData'), 'settings.json')
                        : path.join(__dirname, '../config/settings.json');

                    if (fs.existsSync(settingsPath)) {
                        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
                        if (settings.aiEnabled) {
                            if (!monitorInstance) {
                                const bundledPython = path.join(__dirname, '../../../resources/python_env/python.exe');
                                const isPackaged = electronApp && electronApp.isPackaged;

                                monitorInstance = new HardwareMonitor({
                                    pythonPath: (isPackaged || fs.existsSync(bundledPython))
                                        ? (isPackaged ? path.join(process.resourcesPath, 'python_env/python.exe') : bundledPython)
                                        : 'python'
                                });
                            }

                            const fullReport = await monitorInstance.runFullCheck();
                            mappedDisks.forEach(disk => {
                                // 1. Try matching by Model Name (Reliable)
                                const predictionByModel = fullReport.disks.find(d =>
                                    d.model && disk.name && d.model.toLowerCase().trim() === disk.name.toLowerCase().trim()
                                );

                                // 2. Try matching by Device Index (Fallback for generic names)
                                const predictionByIndex = fullReport.disks.find(d => {
                                    if (!d.device) return false;
                                    // Map /dev/sd[a-z] to 0, 1, 2...
                                    const match = d.device.match(/\/dev\/sd([a-z])/i);
                                    if (match) {
                                        const index = match[1].toLowerCase().charCodeAt(0) - 97;
                                        return index.toString() === disk.device;
                                    }
                                    // Handle PHYSICALDRIVEN naming
                                    const pdMatch = d.device.match(/PHYSICALDRIVE(\d+)/i);
                                    if (pdMatch) {
                                        return pdMatch[1] === disk.device;
                                    }
                                    return false;
                                });

                                const prediction = predictionByModel || predictionByIndex;
                                if (prediction) {
                                    disk.aiHealthStatus = prediction.prediction.status;
                                    disk.anomalyScore = prediction.prediction.anomaly_score;
                                }
                            });
                        }
                    }
                } catch (aiErr) {
                    console.error('AI Health Prediction Error:', aiErr);
                }

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

    startAiScheduler: () => {
        const INTERVAL_MS = 3 * 60 * 60 * 1000; // 3 hours

        const runJob = async () => {
            try {
                // Initialize monitor if needed
                if (!monitorInstance) {
                    const settingsPath = electronApp && electronApp.isPackaged
                        ? path.join(electronApp.getPath('userData'), 'settings.json')
                        : path.join(__dirname, '../config/settings.json');

                    if (fs.existsSync(settingsPath)) {
                        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
                        if (!settings.aiEnabled) return; // Don't run if disabled

                        const bundledPython = path.join(__dirname, '../../../resources/python_env/python.exe');
                        const isPackaged = electronApp && electronApp.isPackaged;
                        monitorInstance = new HardwareMonitor({
                            pythonPath: (isPackaged || fs.existsSync(bundledPython))
                                ? (isPackaged ? path.join(process.resourcesPath, 'python_env/python.exe') : bundledPython)
                                : 'python'
                        });
                    } else {
                        return;
                    }
                }

                console.log("Starting scheduled AI hardware check...");
                const fullReport = await monitorInstance.runFullCheck();
                monitorInstance.saveCachedReport(fullReport);
                console.log("Scheduled check complete. Report cached.");
            } catch (err) {
                console.error("Scheduled AI check failed:", err);
            }
        };

        // Run immediately on start (if no recent report exists)
        setTimeout(async () => {
            // Basic init check
            await runJob();
        }, 30000); // Wait 30s after startup to not hog resources

        // Schedule periodic
        setInterval(runJob, INTERVAL_MS);
    },

    getAiStats: async (req, res) => {
        try {
            const settingsPath = electronApp && electronApp.isPackaged
                ? path.join(electronApp.getPath('userData'), 'settings.json')
                : path.join(__dirname, '../config/settings.json');

            if (!fs.existsSync(settingsPath)) {
                return res.json({ enabled: false });
            }

            const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            if (!settings.aiEnabled) {
                return res.json({ enabled: false });
            }

            if (!monitorInstance) {
                const bundledPython = path.join(__dirname, '../../../resources/python_env/python.exe');
                const isPackaged = electronApp && electronApp.isPackaged;

                monitorInstance = new HardwareMonitor({
                    pythonPath: (isPackaged || fs.existsSync(bundledPython))
                        ? (isPackaged ? path.join(process.resourcesPath, 'python_env/python.exe') : bundledPython)
                        : 'python'
                });
            }

            // Try loading cached report first
            const cached = monitorInstance.loadCachedReport();
            let fullReport = cached;

            // If no cache or cache is too old (> 3 hours), run fresh
            const MAX_AGE = 3 * 60 * 60 * 1000;
            const now = Date.now();
            if (!cached || (now - new Date(cached.timestamp).getTime() > MAX_AGE)) {
                console.log("Cache miss or expired, running fresh check...");
                fullReport = await monitorInstance.runFullCheck();
                monitorInstance.saveCachedReport(fullReport);
            } else {
                console.log("Serving cached AI stats.");
            }

            // Calculate summary
            let totalAnomaly = 0;
            let diskCount = 0;
            fullReport.disks.forEach(d => {
                if (d.prediction && d.prediction.anomaly_score !== undefined) {
                    totalAnomaly += d.prediction.anomaly_score;
                    diskCount++;
                }
            });

            res.json({
                enabled: true,
                timestamp: fullReport.timestamp,
                metrics: fullReport.metrics,
                summary: {
                    avgAnomalyScore: diskCount > 0 ? parseFloat((totalAnomaly / diskCount).toFixed(4)) : 0,
                    diskCount: diskCount,
                    status: (totalAnomaly / diskCount) > 0.05 ? "Warning" : "Healthy"
                }
            });
        } catch (err) {
            console.error('AI Stats Retrieval Error:', err);
            res.status(500).json({ error: err.message });
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
        // We no longer check for "net session" here because we will elevate using Start-Process -Verb RunAs
        // which will prompt the user for admin privileges if they are not already admin.

        const { disks, raidLevel } = req.body;
        let configPath = path.join(__dirname, '../config/storage.json');

        if (electronApp && electronApp.isPackaged) { // Use electronApp reference to check if we should use userData
            configPath = path.join(electronApp.getPath('userData'), 'storage.json');
        }

        try {
            if (os.platform() === 'win32' && disks && disks.length > 0) {
                // Define path for result file
                const resultFilePath = path.join(os.tmpdir(), `ps_result_${Date.now()}.json`);
                // Helper to quote path for PowerShell
                const psQuote = (s) => `'${s.replace(/'/g, "''")}'`;

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
                                $result = @{
                                    Success = $true
                                    VolumePath = "$($partition.DriveLetter):\\"
                                    Message = "Existing Volume Identified Successfully."
                                }
                                $result | ConvertTo-Json | Out-File ${psQuote(resultFilePath)} -Encoding utf8
                            } else {
                                throw "No active partition with a drive letter found on disk $diskId"
                            }
                        } catch {
                             $errResult = @{
                                Success = $false
                                Error = $_.ToString()
                            }
                            $errResult | ConvertTo-Json | Out-File ${psQuote(resultFilePath)} -Encoding utf8
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
                                    
                                    $result = @{
                                        Success = $true
                                        VolumePath = "$($partition.DriveLetter):\\"
                                        Message = "Storage Setup Completed Successfully."
                                    }
                                    $result | ConvertTo-Json | Out-File ${psQuote(resultFilePath)} -Encoding utf8
                                } else {
                                    throw "Failed to create Virtual Disk."
                                }
                            } else {
                                throw "Failed to create Storage Pool."
                            }
                        } catch {
                            $errResult = @{
                                Success = $false
                                Error = $_.ToString()
                            }
                            $errResult | ConvertTo-Json | Out-File ${psQuote(resultFilePath)} -Encoding utf8
                            exit 1
                        }
                    `;
                }

                // Execute the script - NOW with ADMIN Privileges
                console.log('Execute storage setup command (Admin Request)...');

                // We execute the script, which now handles writing to the result file
                try {
                    const output = await runPowerShell(psScript, true);
                    console.log("Storage Setup Output:", output);
                } catch (execErr) {
                    console.error("Script execution finished with error state (check result file):", execErr.message);
                }

                // Check for result file
                if (fs.existsSync(resultFilePath)) {
                    try {
                        let resultFileContent = fs.readFileSync(resultFilePath, 'utf8');
                        // Strip BOM if present (PowerShell 5.1 adds it by default for UTF8)
                        resultFileContent = resultFileContent.replace(/^\uFEFF/, '');

                        const result = JSON.parse(resultFileContent);

                        // Cleanup
                        fs.unlinkSync(resultFilePath);

                        if (result.Success) {
                            req.body.volumePath = result.VolumePath;
                            console.log(`Detected Volume Path: ${req.body.volumePath}`);
                        } else {
                            throw new Error(result.Error || "Unknown script error");
                        }
                    } catch (parseErr) {
                        console.error("Failed to parse result file:", parseErr);
                        // Don't throw here if we just failed to parse result but script didn't seemingly fail,
                        // although if we can't get volume path, it's a failure.
                        if (!req.body.volumePath) {
                            throw new Error("Failed to retrieve volume path from script result.");
                        }
                    }
                } else {
                    console.warn("Result file not found.");
                    throw new Error("Script executed but returned no result file.");
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

            if (error.message && (error.message.includes('Access denied') || error.message.includes('Access is denied'))) {
                return res.status(403).json({ error: 'Administrator privileges required. Please restart the application as Administrator.' });
            }

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

    getSystemStatus: async (req, res) => {
        const TailscaleService = require('../services/tailscaleService');
        const status = await TailscaleService.getStatus();
        const url = await TailscaleService.getTailscaleUrl();

        res.json({
            installed: status ? status.installed : false,
            status: status ? (status.Self ? 'running' : 'inactive') : 'not_found',
            tailscaleUrl: url,
            serveActive: status ? status.serveActive : false
        });
    },

    factoryReset: async (req, res) => {
        try {
            console.log("Initiating Factory Reset...");
            const { password } = req.body;

            if (!password) {
                return res.status(400).json({ error: 'Password is required' });
            }

            // Verify Admin Password
            const userId = req.user.id;
            UserModel.findById(userId, (err, user) => {
                if (err) return res.status(500).json({ error: 'Database error' });
                if (!user) return res.status(404).json({ error: 'User not found' });

                if (!bcrypt.compareSync(password, user.password)) {
                    return res.status(403).json({ error: 'Incorrect password' });
                }

                // Proceed with reset
                const db = require('../config/database');
                db.close((err) => {
                    if (err) console.error('Error closing database:', err.message);
                    if (err) console.error('Error closing database:', err.message);
                    else console.log('Database connection closed.');

                    // Stop Background Services
                    TransferService.stop();

                    // 2. Delete Files
                    const filesToDelete = [
                        'database.sqlite',
                        'config/storage.json',
                        'config/settings.json'
                    ];

                    const isPackaged = electronApp && electronApp.isPackaged;

                    filesToDelete.forEach(file => {
                        const pathsToDelete = [];

                        // 1. Global userData path
                        if (electronApp) {
                            const userDataPath = electronApp.getPath('userData');
                            if (file === 'database.sqlite') {
                                pathsToDelete.push(path.join(userDataPath, 'database.sqlite'));
                            } else {
                                pathsToDelete.push(path.join(userDataPath, path.basename(file)));
                            }
                        }

                        // 2. Local Source path
                        if (file === 'database.sqlite') {
                            pathsToDelete.push(path.join(__dirname, '../../', 'database.sqlite'));
                        } else {
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
            });

        } catch (error) {
            console.error('Factory Reset Error:', error);
            res.status(500).json({ error: 'Factory reset failed: ' + error.message });
        }
    }
};

module.exports = { systemController, setElectronApp, getElectronApp };
