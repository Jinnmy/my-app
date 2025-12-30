async function initSettingsPage() {
    const toggle = document.getElementById('minimizeToTrayToggle');
    if (!toggle) return;

    // Check User permission to hide sections
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user.role !== 'admin') {
            const sectionsToHide = ['settings-app-defaults', 'settings-ai-features', 'settings-danger-zone'];
            sectionsToHide.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.style.display = 'none';
            });
        }
    } catch (e) {
        console.error('Error checking user permissions', e);
    }

    // Load initial state
    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/settings', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const settings = await response.json();
            toggle.checked = settings.minimizeToTray;
        } else {
            console.error('Failed to load settings');
            // Check if 403, maybe redirect or show error
            if (response.status === 403) {
                document.querySelector('.settings-section').innerHTML = '<p style="color:red">Access Denied: Admin privileges required.</p>';
            }
        }
    } catch (error) {
        console.error('Error fetching settings:', error);
    }

    // Handle changes
    toggle.addEventListener('change', async (e) => {
        const minimizeToTray = e.target.checked;
        const token = localStorage.getItem('token');

        try {
            const response = await fetch('/api/settings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ minimizeToTray })
            });

            if (!response.ok) {
                throw new Error('Failed to update settings');
            }
            console.log('Settings updated');
        } catch (error) {
            console.error('Error updating settings:', error);
            // Revert toggle if failed
            e.target.checked = !minimizeToTray;
            alert('Failed to save setting');
        }
    });
    // AI Settings Logic
    const aiStatusText = document.getElementById('aiStatusText');
    const importBtn = document.getElementById('importModelsBtn');
    const offloadBtn = document.getElementById('offloadModelsBtn');
    const aiToggle = document.getElementById('aiEnabledToggle');
    const downloadProgress = document.getElementById('aiDownloadProgress');
    const aiModelActions = document.getElementById('aiModelActions');

    const updateAiUI = (status) => {
        if (status.ready) {
            aiStatusText.textContent = 'Models Ready';
            aiStatusText.style.color = '#10b981'; // Green
            aiStatusText.style.color = '#10b981'; // Green
            importBtn.style.display = 'none';
            if (offloadBtn) offloadBtn.style.display = 'block';
            aiToggle.disabled = false;
            aiToggle.checked = status.enabled;
            // Hide progress if it was showing
            downloadProgress.style.display = 'none';
        } else {
            aiStatusText.textContent = 'Models Not Found';
            aiStatusText.style.color = '#ef4444'; // Red
            aiStatusText.style.color = '#ef4444'; // Red
            importBtn.style.display = 'block';
            if (offloadBtn) offloadBtn.style.display = 'none';
            aiToggle.disabled = true;
            aiToggle.checked = false;
        }

        // Specific checks if partially ready (optional refinement)
        if (!status.ready && (status.blipReady || status.flanReady)) {
            aiStatusText.textContent = 'Models Incomplete';
            aiStatusText.style.color = '#f59e0b'; // Orange
            // Allow offload if incomplete to clean up
            if (offloadBtn) offloadBtn.style.display = 'block';
        }
    };

    const checkAiStatus = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/settings/ai/status', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const status = await res.json();
                updateAiUI(status);
                return status;
            }
        } catch (e) {
            console.error('Failed to check AI status', e);
        }
        return null;
    };

    // Initial check
    if (aiStatusText) checkAiStatus();

    // Import Button
    if (importBtn) {
        importBtn.addEventListener('click', async () => {
            if (!confirm('This will download approximately 1GB of data. Continue?')) return;

            importBtn.style.display = 'none';
            offloadBtn.style.display = 'none';
            downloadProgress.style.display = 'block';
            aiStatusText.textContent = 'Downloading...';
            aiStatusText.style.color = '#3b82f6'; // Blue

            try {
                const token = localStorage.getItem('token');
                const res = await fetch('/api/settings/ai/download', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (res.ok) {
                    // Start polling
                    const pollInterval = setInterval(async () => {
                        const status = await checkAiStatus();
                        if (status && status.ready) {
                            clearInterval(pollInterval);
                            alert('AI Models downloaded successfully!');
                        }
                    }, 5000);
                } else {
                    alert('Failed to start download.');
                    importBtn.style.display = 'block';
                    downloadProgress.style.display = 'none';
                }
            } catch (e) {
                console.error('Download error', e);
                alert('An error occurred while starting download.');
                importBtn.style.display = 'block';
                downloadProgress.style.display = 'none';
            }
        });
    }

    // Offload Button
    if (offloadBtn) {
        offloadBtn.addEventListener('click', async () => {
            if (!confirm('Are you sure you want to delete the AI models? This will free up space but you will need to re-download them to use AI features again.')) return;

            try {
                const token = localStorage.getItem('token');
                const res = await fetch('/api/settings/ai/offload', {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` }
                });

                if (res.ok) {
                    alert('Models offloaded successfully.');
                    checkAiStatus(); // Refresh UI
                } else {
                    alert('Failed to offload models.');
                }
            } catch (e) {
                console.error('Offload error', e);
                alert('An error occurred while offloading models.');
            }
        });
    }

    // Toggle Handler (Unified with minimizeToggle is fine, but this is specific)
    if (aiToggle) {
        aiToggle.addEventListener('change', async (e) => {
            const aiEnabled = e.target.checked;
            const token = localStorage.getItem('token');

            try {
                const response = await fetch('/api/settings', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ aiEnabled })
                });

                if (!response.ok) throw new Error('Failed');
            } catch (error) {
                console.error('Error updating AI settings:', error);
                e.target.checked = !aiEnabled; // Revert
            }
        });
    }

    // Factory Reset Logic
    const factoryResetBtn = document.getElementById('factoryResetBtn');
    const passwordModal = document.getElementById('passwordModal');
    const modalInput = document.getElementById('modalPasswordInput');
    const modalConfirmBtn = document.getElementById('modalConfirmBtn');
    const modalCancelBtn = document.getElementById('modalCancelBtn');

    if (factoryResetBtn && passwordModal) {
        let resolvePassword = null;

        modalConfirmBtn.onclick = () => {
            if (resolvePassword) resolvePassword(modalInput.value);
            passwordModal.style.display = 'none';
            modalInput.value = '';
        };

        modalCancelBtn.onclick = () => {
            if (resolvePassword) resolvePassword(null);
            passwordModal.style.display = 'none';
            modalInput.value = '';
        };

        const getPassword = () => {
            return new Promise((resolve) => {
                resolvePassword = resolve;
                modalInput.value = '';
                modalInput.disabled = false;
                passwordModal.style.display = 'flex';

                // Ensure window itself has focus (native dialogs can steal it)
                window.focus();

                // Aggressive focus strategy
                const forceFocus = (source) => {
                    // console.log(`Attempting focus (${source})...`);
                    modalInput.blur();
                    modalInput.focus();
                };

                // 1. Immediate
                forceFocus('immediate');

                // 2. Next Frame
                requestAnimationFrame(() => forceFocus('raf'));

                // 3. Timeouts
                setTimeout(() => forceFocus('t50'), 50);
                setTimeout(() => forceFocus('t150'), 150);

                // Electron specific handling
                if (window.electronAPI && window.electronAPI.isElectron) {
                    setTimeout(() => {
                        // console.log('Electron focus enforcement');
                        window.focus(); // Force window focus again
                        modalInput.click(); // Simulate interaction
                        forceFocus('electron-delayed');
                    }, 300);
                }
            });
        };

        // Ensure clicking modal background refocuses input
        passwordModal.addEventListener('click', (e) => {
            if (e.target === passwordModal) {
                modalInput.focus();
            }
        });

        // Prevent duplicate listeners if init is called multiple times on same element
        if (!factoryResetBtn.dataset.hasListener) {
            factoryResetBtn.dataset.hasListener = 'true';
            factoryResetBtn.addEventListener('click', async () => {
                // First confirmation
                if (!confirm('WARNING: Are you sure you want to perform a Factory Reset? This will DELETE ALL DATA and cannot be undone.')) {
                    return;
                }


                const password = await getPassword();

                if (!password) {
                    return; // User cancelled or entered empty password
                }

                // Second confirmation (Safety check)
                if (!confirm('Final Confirmation: All users, files, and settings will be permanently lost. The app will restart. Proceed?')) {
                    return;
                }

                try {
                    factoryResetBtn.disabled = true;
                    factoryResetBtn.textContent = 'Resetting...';

                    const token = localStorage.getItem('token');
                    const response = await fetch('/api/system/factory-reset', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ password })
                    });

                    const result = await response.json();

                    if (response.ok) {
                        alert('Reset complete. The application will now restart.');
                        // In case the backend restart prompt doesn't kill the page immediately
                        document.body.innerHTML = '<div style="color:white;text-align:center;padding:50px;">Resetting application...</div>';
                    } else {
                        throw new Error(result.error || 'Reset failed');
                    }

                } catch (error) {
                    console.error('Factory Reset Error:', error);
                    alert('Factory reset failed: ' + error.message);
                    factoryResetBtn.disabled = false;
                    factoryResetBtn.textContent = 'Reset Application';
                }
            });
        }
    }


    // --- Vault Settings Logic ---
    const vaultStatusText = document.getElementById('vaultStatusText');
    const vaultStatusBadge = document.getElementById('vaultStatusBadge');
    const vaultActions = document.getElementById('vaultActions');
    const vaultEnableAction = document.getElementById('vaultEnableAction');
    const btnChangeVaultPass = document.getElementById('btnChangeVaultPass');
    const btnDisableVault = document.getElementById('btnDisableVault');

    const checkVaultSettings = async () => {
        if (!vaultStatusText) return; // Feature not present

        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/vault/status', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                if (data.enabled) {
                    vaultStatusText.textContent = 'Active';
                    vaultStatusBadge.textContent = 'Enabled';
                    vaultStatusBadge.style.background = 'rgba(16, 185, 129, 0.2)';
                    vaultStatusBadge.style.color = '#10b981';

                    vaultActions.style.display = 'block';
                    vaultEnableAction.style.display = 'none';
                } else {
                    vaultStatusText.textContent = 'Not Configured';
                    vaultStatusBadge.textContent = 'Disabled';
                    vaultStatusBadge.style.background = '#333';
                    vaultStatusBadge.style.color = '#888';

                    vaultActions.style.display = 'none';
                    vaultEnableAction.style.display = 'block';
                }
            }
        } catch (e) {
            console.error('Vault check failed', e);
        }
    };

    // Initial Check
    checkVaultSettings();

    // Handlers
    if (btnDisableVault) {
        btnDisableVault.onclick = async () => {
            const password = prompt("To DISABLE the vault and DELETE ALL ENCRYPTED FILES, please enter your vault password:");
            if (!password) return;

            if (!confirm("FINAL WARNING: This will permanently delete all files in your vault. This cannot be undone. Are you sure?")) return;

            try {
                const token = localStorage.getItem('token');
                const res = await fetch('/api/vault/disable', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ password })
                });

                if (res.ok) {
                    alert('Vault disabled and cleared.');
                    checkVaultSettings();
                } else {
                    const err = await res.json();
                    alert('Failed: ' + (err.error || 'Incorrect password'));
                }
            } catch (e) {
                console.error(e);
                alert('Error disabling vault');
            }
        };
    }

    if (btnChangeVaultPass) {
        btnChangeVaultPass.onclick = () => {
            alert('To change your password, please disable and re-enable the vault (Note: This will clear current files). Password rotation without data loss is not yet supported.');
        };
    }

}

// Expose to window so app.js can call it
window.initSettingsPage = initSettingsPage;
