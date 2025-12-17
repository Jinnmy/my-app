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
}

// Expose to window so app.js can call it
window.initSettingsPage = initSettingsPage;
