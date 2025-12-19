async function initSettingsPage() {
    const toggle = document.getElementById('minimizeToTrayToggle');
    if (!toggle) return;

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
}

// Expose to window so app.js can call it
window.initSettingsPage = initSettingsPage;
