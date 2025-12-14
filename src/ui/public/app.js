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

    // Initialize User Info in Topbar (after it's loaded)
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }

    const userStr = localStorage.getItem('user');
    if (userStr) {
        const user = JSON.parse(userStr);
        const nameDisplay = document.getElementById('userNameDisplay');
        const avatarDisplay = document.getElementById('userAvatar');

        if (nameDisplay) nameDisplay.textContent = user.username || user.email;
        if (avatarDisplay) avatarDisplay.textContent = (user.username || user.email).charAt(0).toUpperCase();
    }

    // Load Default Page (Dashboard Home)
    loadPage('dashboard-home');

    // Setup Navigation Event Listeners
    setupNavigation();
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
    const mainContent = document.getElementById('main-content-area');
    // mainContent.innerHTML = '<div class="loading">Loading...</div>'; // Optional loading state

    try {
        const response = await fetch(`pages/${pageName}.html`);
        if (!response.ok) throw new Error('Page not found');
        const html = await response.text();
        mainContent.innerHTML = html;

        // Initialize Page Scripts if needed
        if (pageName === 'files') {
            if (window.initFilesPage) window.initFilesPage();
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
    navItems.forEach(item => {
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
