document.addEventListener('DOMContentLoaded', () => {
    // Check which page we are on
    const loginForm = document.getElementById('loginForm');
    const dashboardLayout = document.querySelector('.dashboard-layout');

    if (loginForm) {
        handleLogin(loginForm);
    }

    if (dashboardLayout) {
        initDashboard();
    }
});

async function initDashboard() {
    // Load Layout Components
    await loadComponent('components/sidebar.html', 'sidebar-container');
    await loadComponent('components/topbar.html', 'topbar-container');

    // Setup Global Search
    if (window.setupSearch) window.setupSearch();

    // Initialize User Info in Topbar (after it's loaded)
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    // Profile Dropdown Logic
    setupProfileDropdown();

    // Fetch fresh user data (including storage)
    await updateUserData();

    // Load Default Page (Dashboard Home)
    loadPage('dashboard-home');

    // Setup Navigation Event Listeners
    setupNavigation();

    // Setup Sidebar Toggle (Mobile)
    setupSidebarToggle();
}

async function updateUserData() {
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
        const response = await fetch('/api/users/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const user = await response.json();
            localStorage.setItem('user', JSON.stringify(user));
            updateUserDisplay(user);
        } else {
            // Fallback to local storage if API fails (e.g. offline)
            const userStr = localStorage.getItem('user');
            if (userStr) updateUserDisplay(JSON.parse(userStr));
        }
    } catch (e) {
        console.error('Failed to update user data', e);
        const userStr = localStorage.getItem('user');
        if (userStr) updateUserDisplay(JSON.parse(userStr));
    }
}

function updateUserDisplay(user) {
    const nameDisplay = document.getElementById('userNameDisplay');
    const avatarDisplay = document.getElementById('userAvatar');

    if (nameDisplay) nameDisplay.textContent = user.username || user.email;
    if (avatarDisplay) avatarDisplay.textContent = (user.username || user.email).charAt(0).toUpperCase();

    // --- Dashboard Widgets Logic ---
    // User Stats (Doughnut)
    const gaugeCircle = document.getElementById('userStorageChart');
    const gaugeText = document.getElementById('userStoragePercent');
    const usedText = document.getElementById('userStorageUsed');
    const totalText = document.getElementById('userStorageTotal');

    if (gaugeCircle && user.storage_limit) {
        const used = user.used_storage || 0;
        const limit = user.storage_limit;
        const percent = Math.min(100, (used / limit) * 100);

        // Update SVG (stroke-dasharray is "filled, gap", total 100)
        gaugeCircle.setAttribute('stroke-dasharray', `${percent}, 100`);

        // Colors for chart
        gaugeCircle.style.stroke = percent > 90 ? '#ef4444' : (percent > 75 ? '#f59e0b' : '#3b82f6');

        if (gaugeText) gaugeText.textContent = `${Math.round(percent)}%`;
        if (usedText) usedText.textContent = formatBytes(used);
        if (totalText) totalText.textContent = formatBytes(limit);
    }

    // Topbar storage bar (legacy, keep if topbar element exists)
    // Storage Bar in Topbar
    const storageContainer = document.getElementById('storageInfoContainer');
    const storageText = document.getElementById('storageText');
    const storageBarFill = document.getElementById('storageBarFill');

    if (storageContainer && user.storage_limit) {
        storageContainer.style.display = 'flex';
        const used = user.used_storage || 0;
        const limit = user.storage_limit;
        const percent = Math.min(100, (used / limit) * 100);

        storageBarFill.style.width = `${percent}%`;
        storageText.textContent = `${formatBytes(used)} / ${formatBytes(limit)}`;

        // Colors
        storageBarFill.className = 'storage-bar-fill'; // reset
        if (percent > 90) storageBarFill.classList.add('danger');
        else if (percent > 75) storageBarFill.classList.add('warning');
    }

    // --- System Stats on Dashboard ---
    // Check if we are on dashboard home by looking for a unique element
    if (document.getElementById('mainStorageTotal')) {
        fetchSystemData();
    }

    // Update Dropdown Info
    const ddName = document.getElementById('dropdownUserName');
    const ddEmail = document.getElementById('dropdownUserEmail');
    if (ddName) ddName.textContent = user.username || 'User';
    if (ddEmail) ddEmail.textContent = user.email || '';

    // Init Vault Toggle state
    const ddVaultToggle = document.getElementById('dropdownVaultToggle');
    if (ddVaultToggle) {
        const prefs = user.preferences || {};
        // checked if NOT hidden
        ddVaultToggle.checked = !prefs.hideVault;
    }
}

async function fetchSystemData() {
    try {
        const token = localStorage.getItem('token');
        const headers = { 'Authorization': `Bearer ${token}` };

        // 1. Storage Stats
        const storageResp = await fetch('/api/system/stats', { headers });
        if (storageResp.ok) {
            const stats = await storageResp.json();
            const totalEl = document.getElementById('mainStorageTotal');
            const freeEl = document.getElementById('mainStorageFree');
            const statusEl = document.getElementById('mainStorageStatus');

            if (totalEl) totalEl.textContent = formatBytes(stats.total);
            if (freeEl) freeEl.textContent = formatBytes(stats.free);
            if (statusEl) {
                // Simple status logic based on free space
                const percentFree = (stats.free / stats.total) * 100;
                if (percentFree < 10) {
                    statusEl.textContent = 'Low Space';
                    statusEl.className = 'stat-value status-critical';
                } else {
                    statusEl.textContent = 'Healthy';
                    statusEl.className = 'stat-value status-good';
                }
            }
        }

        // 2. Disk Health
        const diskResp = await fetch('/api/system/disks', { headers });
        if (diskResp.ok) {
            const disks = await diskResp.json();
            const diskList = document.getElementById('diskHealthList');
            if (diskList) {
                diskList.innerHTML = '';
                if (disks.length === 0) {
                    diskList.innerHTML = '<div class="empty-message">No disks found</div>';
                }
                disks.forEach(disk => {
                    const row = document.createElement('div');
                    row.className = 'disk-health-row';
                    const isHealthy = (disk.healthStatus || 'Healthy') === 'Healthy';

                    row.innerHTML = `
                        <div class="disk-icon ${isHealthy ? 'healthy' : 'issue'}">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm0 2v16h12V4H6zm2 2h8v2H8V6zm0 4h8v2H8v-2z"/>
                            </svg>
                        </div>
                        <div class="disk-info">
                            <div class="disk-name">${disk.name || disk.device}</div>
                             <div class="disk-sub">${disk.mediaType} • ${formatBytes(disk.size)}</div>
                        </div>
                        <div class="disk-status">
                            <span class="status-badge ${isHealthy ? 'good' : 'bad'}">${disk.healthStatus || 'Healthy'}</span>
                        </div>
                    `;
                    diskList.appendChild(row);
                });
            }
        }

    } catch (e) {
        console.error("Failed to fetch system stats", e);
    }
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

async function loadComponent(path, targetId) {
    try {
        const response = await fetch(path);
        const html = await response.text();
        document.getElementById(targetId).innerHTML = html;
    } catch (error) {
        console.error(`Error loading component from ${path}:`, error);
    }
}

async function loadPage(pageName) {
    window.currentPage = pageName;

    // Check environment (Electron) and restrict Files/Trash page
    if ((pageName === 'files' || pageName === 'trash') && window.electronAPI && window.electronAPI.isElectron) {
        console.log('Files/Trash page is restricted in Electron app');
        // Redirect to dashboard or show error? Let's redirect to dashboard
        return loadPage('dashboard-home');
    }

    const mainContent = document.getElementById('main-content-area');
    // mainContent.innerHTML = '<div class="loading">Loading...</div>'; // Optional loading state

    try {
        const response = await fetch(`pages/${pageName}.html`);
        if (!response.ok) throw new Error('Page not found');
        const html = await response.text();
        mainContent.innerHTML = html;

        // Initialize Page Scripts if needed
        if (pageName === 'files') {
            if (window.initFilesPage) await window.initFilesPage();
        } else if (pageName === 'users') {
            if (window.initUsersPage) await window.initUsersPage();
        } else if (pageName === 'dashboard-home') {
            const isElectron = window.electronAPI && window.electronAPI.isElectron;

            if (isElectron) {
                // Electron: Show Stats (default), Hide Recent (default)
                const recentSection = document.querySelector('.recent-files-section');
                if (recentSection) recentSection.style.display = 'none';
                fetchSystemData();
            } else {
                // Web: Hide Stats, Show Recent
                const statsRow = document.querySelector('.dashboard-widgets-row');
                if (statsRow) statsRow.style.display = 'none';

                loadRecentFiles();
            }

            const user = JSON.parse(localStorage.getItem('user'));
            if (user) updateUserDisplay(user);
        } else if (pageName === 'settings') {
            if (window.initSettingsPage) await window.initSettingsPage();
        } else if (pageName === 'trash') {
            if (window.initTrashPage) await window.initTrashPage();
        } else if (pageName === 'allocations') {
            if (window.initAllocationsPage) await window.initAllocationsPage();
        } else if (pageName === 'vault') {
            if (window.initVaultPage) await window.initVaultPage();
        }

        // Update active state in sidebar
        updateActiveNavLink(pageName);
    } catch (error) {
        console.error(`Error loading page ${pageName}:`, error);
        mainContent.innerHTML = '<div class="error-message">Error loading page content.</div>';
    }
}

function setupNavigation() {
    // Delegate click event for sidebar navigation
    document.body.addEventListener('click', (e) => {
        const navItem = e.target.closest('.nav-item');
        if (navItem && navItem.dataset.page) {
            e.preventDefault();
            const pageName = navItem.dataset.page;
            loadPage(pageName);
        }
    });
}

function updateActiveNavLink(pageName) {
    const navItems = document.querySelectorAll('.nav-item');
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    navItems.forEach(item => {
        // Hide Users and Settings link if not admin
        if ((item.dataset.page === 'users' || item.dataset.page === 'settings') && user.role !== 'admin') {
            item.style.display = 'none';
        } else {
            // New check: Hide Files and Trash link if in Electron
            if ((item.dataset.page === 'files' || item.dataset.page === 'trash') && window.electronAPI && window.electronAPI.isElectron) {
                item.style.display = 'none';
            } else if (item.dataset.page === 'allocations') {
                // ONLY show Allocations in Electron AND if admin
                if (window.electronAPI && window.electronAPI.isElectron && user.role === 'admin') {
                    item.style.display = 'flex';
                } else {
                    item.style.display = 'none';
                }
            } else if (item.dataset.page === 'vault') {
                // Check preferences
                const preferences = user.preferences || {};
                // If hideVault is true, hide it. Default is show (so if hideVault is undefined/false, show)
                if (preferences.hideVault) {
                    item.style.display = 'none';
                } else {
                    item.style.display = 'flex';
                }
            } else {
                item.style.display = 'flex'; // Ensure visible
            }
        }

        if (item.dataset.page === pageName) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

function handleLogin(form) {
    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const loginBtn = document.getElementById('loginBtn');
    const errorMessage = document.getElementById('errorMessage');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        // Reset state
        errorMessage.textContent = '';
        loginBtn.disabled = true;
        loginBtn.textContent = 'Signing in...';

        const email = emailInput.value;
        const password = passwordInput.value;

        try {
            const response = await fetch('/api/users/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (response.ok) {
                // Login success
                localStorage.setItem('token', data.token);
                localStorage.setItem('user', JSON.stringify(data.user));

                // Redirect to dashboard
                window.location.href = 'dashboard.html';
            } else {
                // Login failed
                errorMessage.textContent = data.error || 'Login failed. Please try again.';
                loginBtn.disabled = false;
                loginBtn.textContent = 'Sign In';
            }
        } catch (error) {
            console.error('Login error:', error);
            errorMessage.textContent = 'An error occurred. Please check your connection.';
            loginBtn.disabled = false;
            loginBtn.textContent = 'Sign In';
        }
    });
}

function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = 'index.html';
}

async function loadRecentFiles() {
    const list = document.getElementById('recent-files-list');
    const emptyState = document.getElementById('dashboard-empty-state');
    if (!list) return;

    list.innerHTML = '<div class="loading-state">Loading recent files...</div>';
    emptyState.style.display = 'none';

    try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/files/recent?limit=5', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const files = await response.json();
            list.innerHTML = '';

            if (files.length === 0) {
                // hide recent section or show "No recent files"
                document.querySelector('.recent-files-section').style.display = 'none';
                emptyState.style.display = 'flex';
            } else {
                document.querySelector('.recent-files-section').style.display = 'block';
                files.forEach(file => {
                    const card = createRecentFileCard(file);
                    list.appendChild(card);
                });
            }
        } else {
            console.error('Failed to load recent files');
            list.innerHTML = '<div class="error-state">Failed to load recent files</div>';
        }
    } catch (e) {
        console.error('Error loading recent files:', e);
        list.innerHTML = '<div class="error-state">Error loading recent files</div>';
    }
}

function createRecentFileCard(file) {
    const fileCard = document.createElement('div');
    fileCard.className = 'file-card';
    // Minimal event listeners for recent files (mostly just open/view)

    // Determine File Type (Simplified version of files.js logic)
    const isImage = file.type === 'file' && /\.(jpg|jpeg|png|gif|webp|heic)$/i.test(file.name);
    const isVideo = file.type === 'file' && /\.(mp4|webm|ogg|mkv)$/i.test(file.name);
    const isDocx = file.type === 'file' && file.name.toLowerCase().endsWith('.docx');

    let icon = '';
    if (file.type === 'folder') {
        icon = `
        <svg xmlns="http://www.w3.org/2000/svg" class="file-icon folder-icon" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.5 21a3 3 0 0 0 3-3v-4.5a3 3 0 0 0-3-3h-15a3 3 0 0 0-3 3V18a3 3 0 0 0 3 3h15ZM1.5 10.146V6a3 3 0 0 1 3-3h5.379a2.25 2.25 0 0 1 1.59.659l2.122 2.121c.14.141.331.22.53.22H19.5a3 3 0 0 1 3 3v1.146A4.483 4.483 0 0 0 19.5 9h-15a4.483 4.483 0 0 0-3 1.146Z" />
        </svg>`;
    } else if (isImage) {
        const token = localStorage.getItem('token');
        const imageUrl = `/api/files/download/${file.id}?token=${token}`;
        icon = `<img src="${imageUrl}" alt="${file.name}" class="file-preview-img" loading="lazy" />`;
    } else if (isVideo) {
        icon = `
        <svg xmlns="http://www.w3.org/2000/svg" class="file-icon video-icon" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4.5 4.5a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h8.25a3 3 0 0 0 3-3v-9a3 3 0 0 0-3-3H4.5ZM19.94 18.75l-2.69-2.69V7.94l2.69-2.69c.944-.945 2.56-.276 2.56 1.06v11.38c0 1.336-1.616 2.005-2.56 1.06Z" />
        </svg>`;
    } else {
        icon = `
        <svg xmlns="http://www.w3.org/2000/svg" class="file-icon doc-icon" viewBox="0 0 24 24" fill="currentColor">
            <path fill-rule="evenodd" d="M5.625 1.5H9a3.75 3.75 0 0 1 3.75 3.75v1.875c0 1.036.84 1.875 1.875 1.875H16.5a3.75 3.75 0 0 1 3.75 3.75v7.875c0 1.035-.84 1.875-1.875 1.875H5.625a1.875 1.875 0 0 1-1.875-1.875V3.375c0-1.036.84-1.875 1.875-1.875ZM12.75 12a.75.75 0 0 0-1.5 0v2.25H9a.75.75 0 0 0 0 1.5h2.25V18a.75.75 0 0 0 1.5 0v-2.25H15a.75.75 0 0 0 0-1.5h-2.25V12Z" clip-rule="evenodd" />
            <path d="M14.25 5.25a5.23 5.23 0 0 0-1.279-3.434 9.768 9.768 0 0 1 6.963 6.963A5.23 5.23 0 0 0 16.5 7.5h-1.875a.375.375 0 0 1-.375-.375V5.25Z" />
        </svg>`;
    }

    fileCard.innerHTML = `
        <div class="file-icon-wrapper">${icon}</div>
        <div class="file-info">
            <div class="file-name" title="${file.name}">${file.name}</div>
            <div class="file-meta">${file.type === 'folder' ? 'Folder' : formatBytes(file.size)}</div>
        </div>
    `;

    // Add tooltip attributes like in files.js
    if (file.caption) fileCard.dataset.caption = file.caption;
    if (file.tags) {
        try {
            fileCard.dataset.tags = typeof file.tags === 'string' ? file.tags : JSON.stringify(file.tags);
        } catch (e) {
            console.error(e);
        }
    }

    // Tooltip Events
    if (window.showTooltip) { // Check if function exists (loaded from files.js)
        fileCard.addEventListener('mouseenter', (e) => window.showTooltip(e, fileCard));
        fileCard.addEventListener('mouseleave', window.hideTooltip);
        fileCard.addEventListener('mousemove', window.moveTooltip);
    }

    // Interaction - Click to Navigate to Files
    fileCard.style.cursor = 'pointer';
    fileCard.addEventListener('click', (e) => {
        // Prevent navigation if clicking specific actions (like if we had buttons, but we don't here yet)
        // Set pending navigation
        window.pendingNavigate = {
            parentId: file.parent_id || null, // Handle root files (null parent_id)
            fileId: file.id
        };
        // Switch to files page
        loadPage('files');
    });

    return fileCard;
}

function setupSidebarToggle() {
    const toggleBtn = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar-container');
    const overlay = document.getElementById('sidebar-overlay');

    if (toggleBtn && sidebar && overlay) {
        toggleBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
            overlay.classList.toggle('open');
        });

        overlay.addEventListener('click', () => {
            sidebar.classList.remove('open');
            overlay.classList.remove('open');
        });

        // Close sidebar when a nav item is clicked on mobile
        const navItems = sidebar.querySelectorAll('.nav-item');
        navItems.forEach(item => {
            item.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    sidebar.classList.remove('open');
                    overlay.classList.remove('open');
                }
            });
        });
    }
}

function setupProfileDropdown() {
    const profileSection = document.getElementById('userProfileSection');
    const dropdown = document.getElementById('profileDropdown');
    const settingsBtn = document.getElementById('dropdownSettingsBtn');
    const vaultToggle = document.getElementById('dropdownVaultToggle');

    if (profileSection && dropdown) {
        // Toggle Dropdown
        profileSection.addEventListener('click', (e) => {
            // Prevent closing if clicking inside dropdown (except specific actions)
            if (e.target.closest('#profileDropdown')) return;

            dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        });

        // Close when clicking outside
        document.addEventListener('click', (e) => {
            if (!profileSection.contains(e.target) && dropdown.style.display === 'block') {
                dropdown.style.display = 'none';
            }
        });

        // Settings Button
        if (settingsBtn) {
            settingsBtn.addEventListener('click', () => {
                dropdown.style.display = 'none';
                loadPage('settings');
            });
        }

        // Vault Toggle Logic
        if (vaultToggle) {
            vaultToggle.addEventListener('change', async (e) => {
                const showVault = e.target.checked;
                const hideVault = !showVault;
                const token = localStorage.getItem('token');

                try {
                    const response = await fetch('/api/users/preferences', {
                        method: 'PUT',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({ hideVault })
                    });

                    if (response.ok) {
                        // Update local user
                        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
                        currentUser.preferences = currentUser.preferences || {};
                        currentUser.preferences.hideVault = hideVault;
                        localStorage.setItem('user', JSON.stringify(currentUser));

                        // Refresh Sidebar immediately
                        // Re-run checking logic on sidebar items
                        updateActiveNavLink(window.currentPage || 'dashboard-home');

                        // Force toggle display of vault item (updateActiveNavLink handles it now, let's verify)
                        // updateActiveNavLink does check prefs.hideVault.
                        // So calling it should suffice.

                    } else {
                        throw new Error('Failed to update preference');
                    }
                } catch (error) {
                    console.error(error);
                    e.target.checked = !showVault; // revert
                    alert('Failed to save preference');
                }
            });
        }
    }
}
