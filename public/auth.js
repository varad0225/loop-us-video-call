// auth.js

document.addEventListener('DOMContentLoaded', () => {
    // Screens
    const welcomeScreen = document.getElementById('welcome-screen');
    const authScreen = document.getElementById('auth-screen');
    const dashboardScreen = document.getElementById('dashboard-screen');
    
    // Auth Forms
    const loginFormContainer = document.getElementById('login-form-container');
    const registerFormContainer = document.getElementById('register-form-container');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    
    // Buttons & Links
    const navLoginBtn = document.getElementById('nav-login-btn');
    const navRegisterBtn = document.getElementById('nav-register-btn');
    const backToWelcomeBtn = document.getElementById('back-to-welcome');
    const switchToRegister = document.getElementById('switch-to-register');
    const switchToLogin = document.getElementById('switch-to-login');
    const logoutBtn = document.getElementById('logout-btn');

    // State
    window.currentUser = null;

    // --- INIT CHECK ---
    checkAuth();

    async function checkAuth() {
        try {
            const res = await fetch('/api/me');
            if (res.ok) {
                const data = await res.json();
                window.currentUser = data.user;
                showScreen(dashboardScreen);
                if (typeof window.initDashboard === 'function') window.initDashboard();
            } else {
                showScreen(welcomeScreen);
            }
        } catch (err) {
            showScreen(welcomeScreen);
        }
    }

    // --- NAVIGATION LOGIC ---
    function showScreen(screen) {
        document.querySelectorAll('.screen').forEach(s => {
            s.classList.add('hidden');
            s.classList.remove('active');
        });
        screen.classList.remove('hidden');
        screen.classList.add('active');
    }

    navLoginBtn.addEventListener('click', () => {
        showScreen(authScreen);
        loginFormContainer.classList.remove('hidden');
        registerFormContainer.classList.add('hidden');
        document.querySelector('.auth-panel').classList.remove('hidden-anim');
    });

    navRegisterBtn.addEventListener('click', () => {
        showScreen(authScreen);
        registerFormContainer.classList.remove('hidden');
        loginFormContainer.classList.add('hidden');
        document.querySelector('.auth-panel').classList.remove('hidden-anim');
    });

    backToWelcomeBtn.addEventListener('click', () => {
        const panel = document.querySelector('.auth-panel');
        panel.classList.add('hidden-anim');
        setTimeout(() => {
            showScreen(welcomeScreen);
        }, 400); // Wait for animation
    });

    switchToRegister.addEventListener('click', (e) => {
        e.preventDefault();
        loginFormContainer.classList.add('hidden');
        registerFormContainer.classList.remove('hidden');
    });

    switchToLogin.addEventListener('click', (e) => {
        e.preventDefault();
        registerFormContainer.classList.add('hidden');
        loginFormContainer.classList.remove('hidden');
    });

    // --- AUTH ACTIONS ---
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;
        const submitBtn = document.getElementById('login-submit-btn');

        submitBtn.textContent = 'Logging in...';
        submitBtn.disabled = true;

        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });

            if (res.ok) {
                const data = await res.json();
                window.currentUser = data.user;
                showScreen(dashboardScreen);
                if (typeof window.initDashboard === 'function') window.initDashboard();
            } else {
                const error = await res.json();
                alert(error.error || 'Login failed');
            }
        } catch (err) {
            alert('Network error');
        } finally {
            submitBtn.textContent = 'Login 💖';
            submitBtn.disabled = false;
        }
    });

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('register-name').value;
        const username = document.getElementById('register-username').value;
        const password = document.getElementById('register-password').value;
        const confirm = document.getElementById('register-confirm').value;
        const submitBtn = document.getElementById('register-submit-btn');

        if (password !== confirm) {
            return alert('Passwords do not match!');
        }

        submitBtn.textContent = 'Creating Account...';
        submitBtn.disabled = true;

        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, username, password })
            });

            if (res.ok) {
                const data = await res.json();
                window.currentUser = data.user;
                showScreen(dashboardScreen);
                if (typeof window.initDashboard === 'function') window.initDashboard();
            } else {
                const error = await res.json();
                alert(error.error || 'Registration failed');
            }
        } catch (err) {
            alert('Network error');
        } finally {
            submitBtn.textContent = 'Create Account ✨';
            submitBtn.disabled = false;
        }
    });

    logoutBtn.addEventListener('click', async () => {
        try {
            await fetch('/api/logout', { method: 'POST' });
            window.currentUser = null;
            // Close any open connections/streams by resetting UI if needed
            if (typeof resetUI === 'function') resetUI();
            showScreen(welcomeScreen);
        } catch (err) {
            console.error('Logout failed', err);
        }
    });

    // --- UI HELPERS ---
    
    // Toggle Password Visibility
    document.querySelectorAll('.toggle-password').forEach(btn => {
        btn.addEventListener('click', function() {
            const input = this.previousElementSibling;
            const icon = this.querySelector('i');
            if (input.type === 'password') {
                input.type = 'text';
                icon.className = 'fa-solid fa-eye-slash';
            } else {
                input.type = 'password';
                icon.className = 'fa-solid fa-eye';
            }
        });
    });

    // Password Strength Indicator
    const registerPassword = document.getElementById('register-password');
    const strengthBar = document.querySelector('.strength-bar');

    if (registerPassword && strengthBar) {
        registerPassword.addEventListener('input', () => {
            const val = registerPassword.value;
            let strength = 0;
            if (val.length >= 6) strength += 33;
            if (val.match(/[A-Z]/) && val.match(/[0-9]/)) strength += 33;
            if (val.match(/[^A-Za-z0-9]/)) strength += 34;

            strengthBar.style.width = strength + '%';
            
            if (strength <= 33) {
                strengthBar.style.background = '#ef4444'; // Red
            } else if (strength <= 66) {
                strengthBar.style.background = '#eab308'; // Yellow
            } else {
                strengthBar.style.background = '#22c55e'; // Green
            }
        });
    }
});
