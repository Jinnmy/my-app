async function initSettingsPage() {
    const toggle = document.getElementById('minimizeToTrayToggle');
    if (!toggle) return;

    // Check User permission to hide sections
    try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user.role !== 'admin') {
            const sectionsToHide = ['settings-app-defaults', 'settings-ai-features', 'settings-remote-access', 'settings-danger-zone'];
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
        if (!status.ready && (status.blipReady || status.flanReady || status.healthReady)) {
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
    // Generic Password Request Modal
    const passwordModal = document.getElementById('passwordModal');
    const modalInput = document.getElementById('modalPasswordInput');
    const modalConfirmBtn = document.getElementById('modalConfirmBtn');
    const modalCancelBtn = document.getElementById('modalCancelBtn');
    const modalTitle = passwordModal.querySelector('h3');
    const modalText = passwordModal.querySelector('p');

    // Helper to request password
    const requestPassword = (title, message) => {
        return new Promise((resolve) => {
            // Update Modal Text
            if (title) modalTitle.textContent = title;
            if (message) modalText.textContent = message;

            modalInput.value = '';
            modalInput.disabled = false;
            passwordModal.style.display = 'flex';

            const cleanup = () => {
                modalConfirmBtn.onclick = null;
                modalCancelBtn.onclick = null;
                // Reset text defaults if needed, or leave them
            };

            modalConfirmBtn.onclick = () => {
                const val = modalInput.value;
                if (!val) return; // Maybe shake input?
                resolve(val);
                passwordModal.style.display = 'none';
                cleanup();
            };

            modalCancelBtn.onclick = () => {
                resolve(null);
                passwordModal.style.display = 'none';
                cleanup();
            };

            // Focus Logic
            window.focus();
            setTimeout(() => {
                modalInput.focus();
                if (window.electronAPI) window.focus(); // Force match
            }, 100);
        });
    };

    // Ensure clicking modal background refocuses input (or cancels?)
    passwordModal.addEventListener('click', (e) => {
        if (e.target === passwordModal) {
            // Optional: click outside to cancel
            // For now, focus input to be rigorous
            modalInput.focus();
        }
    });

    // Factory Reset Logic
    // Factory Reset Logic (Event Handler)
    if (factoryResetBtn) {
        factoryResetBtn.onclick = async () => {
            // First confirmation
            if (!confirm('WARNING: Are you sure you want to perform a Factory Reset? This will DELETE ALL DATA and cannot be undone.')) {
                return;
            }

            const password = await requestPassword('Admin Password Required', 'Please enter your admin password to proceed with Factory Reset.');

            if (!password) return;

            // Second confirmation
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

                if (response.ok) {
                    alert('Reset complete. The application will now restart.');
                    document.body.innerHTML = '<div style="color:white;text-align:center;padding:50px;">Resetting application...</div>';
                } else {
                    const result = await response.json();
                    throw new Error(result.error || 'Reset failed');
                }

            } catch (error) {
                console.error('Factory Reset Error:', error);
                alert('Factory reset failed: ' + error.message);
                factoryResetBtn.disabled = false;
                factoryResetBtn.textContent = 'Reset Application';
            }
        };
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

    if (btnDisableVault) {
        btnDisableVault.onclick = async () => {
            if (!confirm("FINAL WARNING: This will permanently delete all files in your vault. This cannot be undone. Are you sure?")) return;

            try {
                const token = localStorage.getItem('token');
                const res = await fetch('/api/vault/disable', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({}) // No password needed
                });

                if (res.ok) {
                    alert('Vault disabled and cleared.');
                    checkVaultSettings();
                } else {
                    const err = await res.json();
                    alert('Failed: ' + (err.error || 'Unknown error'));
                }
            } catch (e) {
                console.error(e);
                alert('Error disabling vault');
            }
        };
    }

    if (btnChangeVaultPass) {
        // Change Password Form Logic
        const cpModal = document.getElementById('changePasswordFormModal');
        const cpOldPass = document.getElementById('cpOldPass');
        const cpNewPass = document.getElementById('cpNewPass');
        const cpConfirmPass = document.getElementById('cpConfirmPass');
        const cpCancelBtn = document.getElementById('cpCancelBtn');
        const cpSaveBtn = document.getElementById('cpSaveBtn');

        btnChangeVaultPass.onclick = () => {
            if (cpModal) {
                // Reset Fields
                cpOldPass.value = '';
                cpNewPass.value = '';
                cpConfirmPass.value = '';
                cpModal.style.display = 'flex';
                // Focus first input
                setTimeout(() => cpOldPass.focus(), 100);
            }
        };

        if (cpCancelBtn) {
            cpCancelBtn.onclick = () => {
                cpModal.style.display = 'none';
            };
        }

        if (cpSaveBtn) {
            cpSaveBtn.onclick = async () => {
                const currentPassword = cpOldPass.value;
                const newPassword = cpNewPass.value;
                const confirmPassword = cpConfirmPass.value;

                if (!currentPassword || !newPassword || !confirmPassword) {
                    alert('Please fill in all fields.');
                    return;
                }

                if (newPassword !== confirmPassword) {
                    alert('New passwords do not match.');
                    return;
                }

                if (newPassword.length < 4) {
                    alert('New password must be at least 4 characters.');
                    return;
                }

                try {
                    cpSaveBtn.disabled = true;
                    cpSaveBtn.textContent = 'Processing...';

                    const token = localStorage.getItem('token');
                    const res = await fetch('/api/vault/change-password', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ currentPassword, newPassword })
                    });

                    if (res.ok) {
                        alert('Password changed successfully! All files have been re-encrypted.');
                        cpModal.style.display = 'none';
                    } else {
                        const err = await res.json();
                        alert('Failed: ' + (err.error || 'Unknown error'));
                    }
                } catch (e) {
                    console.error(e);
                    alert('Error changing password');
                } finally {
                    cpSaveBtn.disabled = false;
                    cpSaveBtn.textContent = 'Change Password';
                }
            };
        }

        // Click outside to close
        window.addEventListener('click', (e) => {
            if (e.target === cpModal) {
                cpModal.style.display = 'none';
            }
        });
    }

    // --- Tailscale Settings Logic ---
    const tsStatusText = document.getElementById('tsSettingsStatusText');
    const tsBadge = document.getElementById('tsSettingsBadge');
    const tsUrlSection = document.getElementById('tsSettingsRemoteUrl');
    const tsUrlValue = document.getElementById('tsSettingsUrlValue');
    const tsRefreshBtn = document.getElementById('tsRefreshBtn');

    const checkTailscaleSettings = async () => {
        if (!tsStatusText) return;

        tsStatusText.textContent = 'Checking...';
        tsBadge.textContent = 'Checking';
        tsBadge.style.background = '#333';
        tsBadge.style.color = '#888';

        try {
            const token = localStorage.getItem('token');
            const res = await fetch('/api/system/status', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                if (data.installed) {
                    if (data.status === 'running') {
                        let statusMsg = 'Tailscale is running.';
                        if (data.serveActive) {
                            statusMsg += ' Secure Remote Access (Serve/Funnel) is ACTIVE.';
                            tsBadge.textContent = 'Active + Serve';
                            tsBadge.style.background = 'rgba(16, 185, 129, 0.2)';
                            tsBadge.style.color = '#10b981';
                        } else {
                            statusMsg += ' However, Remote Access (Serve) is not yet active.';
                            tsBadge.textContent = 'Active (Local Only)';
                            tsBadge.style.background = 'rgba(59, 130, 246, 0.2)';
                            tsBadge.style.color = '#3b82f6';
                        }
                        tsStatusText.textContent = statusMsg;

                        if (data.tailscaleUrl) {
                            tsUrlSection.style.display = 'block';
                            tsUrlValue.textContent = data.tailscaleUrl;
                        } else {
                            tsUrlSection.style.display = 'none';
                        }
                    } else {
                        tsStatusText.textContent = 'Tailscale is installed but inactive.';
                        tsBadge.textContent = 'Inactive';
                        tsBadge.style.background = 'rgba(245, 158, 11, 0.2)';
                        tsBadge.style.color = '#f59e0b';
                        tsUrlSection.style.display = 'none';
                    }
                } else {
                    tsStatusText.textContent = 'Tailscale was not detected on this system.';
                    tsBadge.textContent = 'Not Found';
                    tsBadge.style.background = 'rgba(239, 68, 68, 0.2)';
                    tsBadge.style.color = '#ef4444';
                    tsUrlSection.style.display = 'none';
                }
            }
        } catch (e) {
            console.error('Tailscale check failed', e);
            tsStatusText.textContent = 'Failed to retrieve status.';
        }
    };

    if (tsRefreshBtn) {
        tsRefreshBtn.onclick = checkTailscaleSettings;
    }

    // Initial check
    checkTailscaleSettings();


}

// Expose to window so app.js can call it
window.initSettingsPage = initSettingsPage;
