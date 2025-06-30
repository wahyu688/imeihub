document.addEventListener('DOMContentLoaded', () => {
    // --- PENTING: GANTI DENGAN URL API BACKEND ANDA SAAT DEPLOY! ---
    const API_BASE_URL = 'https://back.imeihub.id'; 

    // --- ADMIN API KEY (Ini akan digunakan oleh admin_create_user.html) ---
    const ADMIN_API_KEY = 'your_super_secret_admin_api_key_here'; // <-- GANTI INI DENGAN KUNCI RAHASIA ANDA

    // --- LOGIKA PROTEKSI HALAMAN ---
    const getCurrentPageName = () => {
        const path = window.location.pathname;
        return path.substring(path.lastIndexOf('/') + 1).split('?')[0];
    };
    const currentPage = getCurrentPageName();

    // Proteksi halaman Order
    if (currentPage === 'order.html') {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            localStorage.setItem('redirectAfterLogin', window.location.href);
            window.location.href = 'login.html';
            return;
        }
    }

    // Proteksi halaman My Orders
    if (currentPage === 'my-orders.html') {
        const authToken = localStorage.getItem('authToken');
        const userId = localStorage.getItem('userId');
        if (!authToken || !userId) {
            localStorage.setItem('redirectAfterLogin', window.location.href);
            window.location.href = 'login.html';
            return;
        }
    }

    // Proteksi halaman Admin Dashboard dan Admin Create User
    if (currentPage.startsWith('admin_')) { // Semua halaman yang dimulai dengan 'admin_'
        const authToken = localStorage.getItem('authToken');
        const isAdmin = localStorage.getItem('isAdmin') === 'true'; // Cek flag isAdmin
        if (!authToken || !isAdmin) {
            alert('Akses Ditolak: Anda harus login sebagai Admin.'); // Notifikasi sederhana
            localStorage.setItem('redirectAfterLogin', window.location.href);
            window.location.href = 'login.html';
            return;
        }
    }
    // --- AKHIR LOGIKA PROTEKSI ---


    // --- Manajemen Status Login di Navbar (Top & Mobile Overlay) ---
    const navLoginRegister = document.getElementById('nav-login-register');
    const navUserGreeting = document.getElementById('nav-user-greeting');
    const usernameDisplay = document.getElementById('username-display');
    const logoutBtnNavbar = document.getElementById('logout-btn-navbar');
    const navAdminDashboard = document.getElementById('nav-admin-dashboard'); // Link Admin Dashboard Desktop
    
    const hamburgerMenu = document.querySelector('.hamburger-menu');
    const mobileNavOverlay = document.querySelector('.mobile-nav-overlay');
    const closeMobileNav = document.querySelector('.close-mobile-nav');
    const mobileNavLoginRegister = document.getElementById('mobile-nav-login-register');
    const mobileNavUserGreeting = document.getElementById('mobile-nav-user-greeting');
    const mobileUsernameDisplay = document.getElementById('mobile-username-display');
    const mobileLogoutBtn = document.getElementById('mobile-logout-btn');
    const mobileNavAdminDashboard = document.getElementById('mobile-nav-admin-dashboard'); // Link Admin Dashboard Mobile


    const authTokenOnLoad = localStorage.getItem('authToken');
    const userNameOnLoad = localStorage.getItem('userName');
    const isAdminOnLoad = localStorage.getItem('isAdmin') === 'true';

    function updateNavbarLoginStatus() {
        if (authTokenOnLoad && userNameOnLoad) {
            // Desktop Navbar
            if (navLoginRegister) navLoginRegister.style.display = 'none';
            if (navUserGreeting) {
                navUserGreeting.style.display = 'flex';
                if (usernameDisplay) usernameDisplay.textContent = userNameOnLoad;
            }
            if (logoutBtnNavbar) logoutBtnNavbar.style.display = 'block';
            if (navAdminDashboard) navAdminDashboard.style.display = isAdminOnLoad ? 'block' : 'none'; // Tampilkan hanya jika admin

            // Mobile Overlay Navbar
            if (mobileNavLoginRegister) mobileNavLoginRegister.style.display = 'none';
            if (mobileNavUserGreeting) {
                mobileNavUserGreeting.style.display = 'list-item';
                if (mobileUsernameDisplay) mobileUsernameDisplay.textContent = userNameOnLoad;
            }
            if (mobileLogoutBtn) mobileLogoutBtn.style.display = 'block';
            if (mobileNavAdminDashboard) mobileNavAdminDashboard.style.display = isAdminOnLoad ? 'list-item' : 'none'; // Tampilkan hanya jika admin

        } else {
            // Desktop Navbar
            if (navLoginRegister) navLoginRegister.style.display = 'block';
            if (navUserGreeting) navUserGreeting.style.display = 'none';
            if (logoutBtnNavbar) logoutBtnNavbar.style.display = 'none';
            if (navAdminDashboard) navAdminDashboard.style.display = 'none';

            // Mobile Overlay Navbar
            if (mobileNavLoginRegister) mobileNavLoginRegister.style.display = 'list-item';
            if (mobileNavUserGreeting) mobileNavUserGreeting.style.display = 'none';
            if (mobileLogoutBtn) mobileLogoutBtn.style.display = 'none';
            if (mobileNavAdminDashboard) mobileNavAdminDashboard.style.display = 'none';
        }
    }
    updateNavbarLoginStatus();

    // Event Listener untuk Logout Button (Global)
    if (logoutBtnNavbar) {
        logoutBtnNavbar.addEventListener('click', () => {
            localStorage.removeItem('authToken');
            localStorage.removeItem('userId');
            localStorage.removeItem('userName');
            localStorage.removeItem('isAdmin'); // Hapus juga isAdmin
            updateNavbarLoginStatus(); 
            window.location.href = 'login.html';
        });
    }
    // Event Listener untuk Logout Button Mobile
    if (mobileLogoutBtn) {
        mobileLogoutBtn.addEventListener('click', () => {
            localStorage.removeItem('authToken');
            localStorage.removeItem('userId');
            localStorage.removeItem('userName');
            localStorage.removeItem('isAdmin'); // Hapus juga isAdmin
            updateNavbarLoginStatus();
            mobileNavOverlay.classList.remove('open');
            window.location.href = 'login.html';
        });
    }
    // --- Akhir Manajemen Status Login ---

    // --- Hamburger Menu Logic ---
    if (hamburgerMenu) {
        hamburgerMenu.addEventListener('click', () => {
            mobileNavOverlay.classList.toggle('open');
        });
    }
    if (closeMobileNav) {
        closeMobileNav.addEventListener('click', () => {
            mobileNavOverlay.classList.remove('open');
        });
    }
    document.querySelectorAll('.mobile-nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            mobileNavOverlay.classList.remove('open');
        });
    });
    // --- End Hamburger Menu Logic ---


    // --- Page-specific JavaScript Logic ---

    // Order and Payment Submission (Only on order.html)
    const orderForm = document.getElementById('order-submission-form');
    console.log('DEBUG: orderForm element found:', orderForm);
    
    if (orderForm) {
        const orderStatusDiv = document.getElementById('order-status');
        console.log('DEBUG: orderStatusDiv element found:', orderStatusDiv);

        const urlParams = new URLSearchParams(window.location.search);
        const serviceParam = urlParams.get('service');
        if (serviceParam) {
            const serviceSelect = document.getElementById('service-type');
            if (serviceSelect) {
                let serviceToSelect = '';
                switch(serviceParam) {
                    case 'Temporary IMEI Activation (90 Days)': serviceToSelect = 'Temporary IMEI Activation (90 Days)'; break;
                    case 'Permanent Unlock iPhone': serviceToSelect = 'Permanent Unlock iPhone'; break;
                    case 'Permanent Unlock Android': serviceToSelect = 'Permanent Unlock Android'; break;
                    case 'IMEI History Check': serviceToSelect = 'IMEI History Check'; break;
                    case 'Other Service': serviceToSelect = 'Other Service'; break;
                    default: serviceToSelect = '';
                }
                if (serviceToSelect) {
                    serviceSelect.value = serviceToSelect;
                }
            }
        }

        orderForm.addEventListener('submit', async (e) => {
            console.log('DEBUG: Order form submit event triggered.');
            e.preventDefault();
            console.log('DEBUG: Default form submission prevented.');

            orderStatusDiv.innerHTML = `<p style="color: var(--accent-color);">Memproses pesanan Anda dan menginisiasi pembayaran...</p>`;
            orderStatusDiv.classList.remove('error');
            orderStatusDiv.style.backgroundColor = 'var(--card-bg)';
            orderStatusDiv.style.borderColor = 'var(--accent-color)';
            orderStatusDiv.style.color = 'var(--text-color)';
            
            const formData = new FormData(orderForm);
            const orderData = {};
            for (let [key, value] of formData.entries()) {
                orderData[key] = value;
            }
            let amount = 0;
            switch(orderData.serviceType) {
                case 'Temporary IMEI Activation (90 Days)': amount = 100000; break;
                case 'Permanent Unlock iPhone': amount = 500000; break;
                case 'Permanent Unlock Android': amount = 300000; break;
                case 'IMEI History Check': amount = 50000; break;
                case 'Other Service': amount = 75000; break;
                default: amount = 10000;
            }
            orderData.amount = amount;

            console.log('DEBUG: Order data collected for payment initiation:', orderData);

            const userId = localStorage.getItem('userId');
            if (userId) {
                orderData.userId = userId;
            } else {
                console.error('DEBUG: User ID not found in localStorage during order submission. Redirection expected if not logged in.');
                orderStatusDiv.innerHTML = '<p style="color: red;">Error: Anda harus login untuk membuat pesanan. Silakan coba refresh halaman.</p>';
                orderStatusDiv.classList.add('error');
                orderStatusDiv.style.backgroundColor = 'var(--card-bg)';
                orderStatusDiv.style.borderColor = 'red';
                orderStatusDiv.style.color = 'red';
                return;
            }

            try {
                const targetApiUrl = `${API_BASE_URL}/api/payment/initiate`;
                console.log('DEBUG: Attempting to fetch payment initiation API from:', targetApiUrl);
                
                const response = await fetch(targetApiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                    },
                    body: JSON.stringify(orderData)
                });
                console.log('DEBUG: Payment initiation API response received. Status:', response.status);

                const contentType = response.headers.get('content-type');
                let result = {};
                if (contentType && contentType.includes('application/json')) {
                    result = await response.json();
                } else {
                    console.warn('DEBUG: Payment initiation API did not return JSON. Status:', response.status, 'Content-Type:', contentType);
                    result.message = await response.text() || `Response status: ${response.status}`;
                }
                console.log('DEBUG: Payment initiation API response parsed (or text):', result);

                if (response.ok && result.success) {
                    const selectedPaymentMethod = orderData.paymentMethod;

                    orderStatusDiv.innerHTML = `
                        <p style="color: green;">Inisiasi pembayaran berhasil! Tunggu pengalihan...</p>
                        <p style="color: var(--secondary-text-color);">Nomor referensi: <strong>${result.reference}</strong></p>
                        <p style="color: var(--secondary-text-color);">Metode: <strong>${orderData.paymentMethod}</strong></p>
                    `;
                    orderStatusDiv.style.backgroundColor = 'var(--card-bg)';
                    orderStatusDiv.style.borderColor = 'var(--accent-color)';
                    orderStatusDiv.style.color = 'var(--text-color)';
                    orderStatusDiv.classList.remove('error');
                    
                    orderForm.reset();

                    // --- Penanganan Respons Tripay ---
                    if (result.checkout_url) {
                        console.log('DEBUG: Redirecting to Tripay checkout URL:', result.checkout_url);
                        window.location.href = result.checkout_url;
                    } else if (result.qr_string) {
                        orderStatusDiv.innerHTML += `
                            <p style="font-size: 1.1em; margin-top: 20px; font-weight: bold; color: var(--accent-color);">Scan QRIS ini:</p>
                            <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(result.qr_string)}" alt="QRIS Code" style="margin: 10px auto; display: block;">
                            <p style="color: var(--secondary-text-color);">Instruksi pembayaran: ${result.instructions || 'Lihat aplikasi pembayaran Anda.'}</p>
                            <p><a href="my-orders.html" class="cta-button" style="margin-top: 15px;">Lihat Status Pesanan Saya</a></p>
                        `;
                        orderStatusDiv.style.backgroundColor = 'var(--card-bg)';
                        orderStatusDiv.style.borderColor = 'var(--accent-color)';
                        orderStatusDiv.style.color = 'var(--text-color)';
                    } else if (result.va_number) {
                        orderStatusDiv.innerHTML += `
                            <p style="font-size: 1.1em; margin-top: 20px; font-weight: bold; color: var(--accent-color);">Detail Virtual Account:</p>
                            <p style="color: var(--secondary-text-color);">Bank: <strong>${result.va_bank}</strong></p>
                            <p style="color: var(--secondary-text-color);">Nomor VA: <strong>${result.va_number}</strong></p>
                            <p style="color: var(--secondary-text-color);">Total: <strong>Rp ${result.amount}</strong></p>
                            <p style="color: var(--secondary-text-color);">Instruksi pembayaran: ${result.instructions || 'Cek aplikasi pembayaran Anda.'}</p>
                            <p><a href="my-orders.html" class="cta-button" style="margin-top: 15px;">Lihat Status Pesanan Saya</a></p>
                        `;
                        orderStatusDiv.style.backgroundColor = 'var(--card-bg)';
                        orderStatusDiv.style.borderColor = 'var(--accent-color)';
                        orderStatusDiv.style.color = 'var(--text-color)';
                    } else {
                        orderStatusDiv.innerHTML += `
                            <p style="color: var(--secondary-text-color);">Silakan tunggu konfirmasi pembayaran.</p>
                            <p><a href="my-orders.html" class="cta-button" style="margin-top: 15px;">Lihat Status Pesanan Saya</a></p>
                        `;
                        orderStatusDiv.style.backgroundColor = 'var(--card-bg)';
                        orderStatusDiv.style.borderColor = 'var(--accent-color)';
                        orderStatusDiv.style.color = 'var(--text-color)';
                    }
                } else {
                    const errorMessage = result.message || `Gagal menginisiasi pembayaran. Status: ${response.status}.`;
                    console.error('DEBUG: Payment initiation API responded with error:', errorMessage);
                    orderStatusDiv.innerHTML = `<p style="color: red;">Terjadi kesalahan: ${errorMessage}</p>`;
                    orderStatusDiv.classList.add('error');
                    orderStatusDiv.style.backgroundColor = 'var(--card-bg)';
                    orderStatusDiv.style.borderColor = 'red';
                    orderStatusDiv.style.color = 'red';
                }
            } catch (error) {
                console.error('DEBUG: Error initiating payment (fetch failed/network issue):', error);
                orderStatusDiv.innerHTML = `<p style="color: red;">Terjadi masalah jaringan atau server. Pastikan backend berjalan dengan benar dan coba lagi nanti.</p>`;
                orderStatusDiv.classList.add('error');
                orderStatusDiv.style.backgroundColor = 'var(--card-bg)';
                orderStatusDiv.style.borderColor = 'red';
                orderStatusDiv.style.color = 'red';
                return;
            }
        });
    }

    // Login functionality (Only on login.html)
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        const loginStatusDiv = document.getElementById('login-status');
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('login-username').value;
            const password = document.getElementById('login-password').value;

            loginStatusDiv.innerHTML = `<p style="color: var(--accent-color);">Logging in...</p>`;
            loginStatusDiv.classList.remove('error');
            loginStatusDiv.style.backgroundColor = 'var(--card-bg)';
            loginStatusDiv.style.borderColor = 'var(--accent-color)';
            loginStatusDiv.style.color = 'var(--text-color)';


            try {
                const response = await fetch(`${API_BASE_URL}/api/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });
                const data = await response.json();

                if (response.ok && data.token && data.userName) {
                    localStorage.setItem('authToken', data.token);
                    localStorage.setItem('userId', data.userId);
                    localStorage.setItem('userName', data.userName);
                    localStorage.setItem('isAdmin', data.isAdmin); // Simpan isAdmin flag
                    loginStatusDiv.innerHTML = '<p style="color: green;">Login berhasil! Mengarahkan...</p>';
                    loginStatusDiv.classList.remove('error');
                    loginStatusDiv.style.backgroundColor = 'var(--card-bg)';
                    loginStatusDiv.style.borderColor = 'var(--accent-color)';
                    loginStatusDiv.style.color = 'var(--text-color)';
                    
                    updateNavbarLoginStatus(); 

                    const redirectUrl = localStorage.getItem('redirectAfterLogin') || 'my-orders.html';
                    localStorage.removeItem('redirectAfterLogin');
                    window.location.href = redirectUrl; 
                } else {
                    const errorMessage = data.message || 'Login gagal. Username atau password salah.';
                    console.error('DEBUG: Login API responded with error:', errorMessage);
                    loginStatusDiv.innerHTML = `<p style="color: red;">${errorMessage}</p>`;
                    loginStatusDiv.classList.add('error');
                    loginStatusDiv.style.backgroundColor = 'var(--card-bg)';
                    loginStatusDiv.style.borderColor = 'red';
                    loginStatusDiv.style.color = 'red';
                }
            } catch (error) {
                console.error('DEBUG: Login error (fetch failed/network issue):', error);
                loginStatusDiv.innerHTML = `<p style="color: red;">Terjadi masalah jaringan atau server. Pastikan backend berjalan dengan benar dan coba lagi nanti.</p>`;
                loginStatusDiv.classList.add('error');
                loginStatusDiv.style.backgroundColor = 'var(--card-bg)';
                loginStatusDiv.style.borderColor = 'red';
                loginStatusDiv.style.color = 'red';
                return;
            }
        });
    }

    // Admin Create User functionality (Only on admin_create_user.html)
    const createUserForm = document.getElementById('create-user-form');
    if (createUserForm) {
        const adminCreateUserStatusDiv = document.getElementById('admin-create-user-status');
        createUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('admin-username').value;
            const fullname = document.getElementById('admin-fullname').value;
            const email = document.getElementById('admin-email').value;
            const password = document.getElementById('admin-password').value;

            adminCreateUserStatusDiv.innerHTML = `<p style="color: var(--accent-color);">Creating user account...</p>`;
            adminCreateUserStatusDiv.classList.remove('error');
            adminCreateUserStatusDiv.style.backgroundColor = 'var(--card-bg)';
            adminCreateUserStatusDiv.style.borderColor = 'var(--accent-color)';
            adminCreateUserStatusDiv.style.color = 'var(--text-color)';

            const headers = {
                'Content-Type': 'application/json',
                'X-Admin-API-Key': ADMIN_API_KEY
            };

            try {
                const response = await fetch(`${API_BASE_URL}/api/admin/create-user`, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({ username, fullname, email, password })
                });
                const data = await response.json();

                if (response.ok) {
                    adminCreateUserStatusDiv.innerHTML = `<p style="color: green;">User "${username}" created successfully!</p>`;
                    adminCreateUserStatusDiv.classList.remove('error');
                    adminCreateUserStatusDiv.style.backgroundColor = 'var(--card-bg)';
                    adminCreateUserStatusDiv.style.borderColor = 'var(--accent-color)';
                    adminCreateUserStatusDiv.style.color = 'var(--text-color)';
                    createUserForm.reset();
                } else {
                    const errorMessage = data.message || 'Failed to create user. Please try again.';
                    console.error('DEBUG: Admin Create User API responded with error:', errorMessage);
                    adminCreateUserStatusDiv.innerHTML = `<p style="color: red;">Error: ${errorMessage}</p>`;
                    adminCreateUserStatusDiv.classList.add('error');
                    adminCreateUserStatusDiv.style.backgroundColor = 'var(--card-bg)';
                    adminCreateUserStatusDiv.style.borderColor = 'red';
                    adminCreateUserStatusDiv.style.color = 'red';
                }
            } catch (error) {
                console.error('DEBUG: Admin Create User error (fetch failed/network issue):', error);
                adminCreateUserStatusDiv.innerHTML = `<p style="color: red;">Terjadi masalah jaringan atau server. Pastikan backend berjalan dengan benar dan coba lagi nanti.</p>`;
                adminCreateUserStatusDiv.classList.add('error');
                adminCreateUserStatusDiv.style.backgroundColor = 'var(--card-bg)';
                adminCreateUserStatusDiv.style.borderColor = 'red';
                adminCreateUserStatusDiv.style.color = 'red';
                return;
            }
        });
    }

    // --- Admin Dashboard Logic (Only on admin_dashboard.html) ---
    const adminDashboardContent = document.getElementById('admin-dashboard-content');
    const dashboardOverviewContent = document.getElementById('dashboard-overview-content');
    const manageOrdersContent = document.getElementById('manage-orders-content');
    const manageUsersContent = document.getElementById('manage-users-content');
    const adminContentTitle = document.getElementById('admin-content-title');

    const dashboardLink = document.getElementById('dashboard-link');
    const manageOrdersLink = document.getElementById('manage-orders-link');
    const manageUsersLink = document.getElementById('manage-users-link');
    const createUserLink = document.getElementById('create-user-link'); // Create User link in sidebar

    if (currentPage === 'admin_dashboard.html') {
        function showSection(sectionId) {
            dashboardOverviewContent.style.display = 'none';
            manageOrdersContent.style.display = 'none';
            manageUsersContent.style.display = 'none';

            // Remove active class from all sidebar links
            document.querySelectorAll('.admin-sidebar ul li a').forEach(link => {
                link.classList.remove('active');
            });

            if (sectionId === 'dashboard-overview') {
                dashboardOverviewContent.style.display = 'block';
                adminContentTitle.textContent = 'Dashboard Overview';
                dashboardLink.classList.add('active');
                fetchDashboardStats();
            } else if (sectionId === 'manage-orders') {
                manageOrdersContent.style.display = 'block';
                adminContentTitle.textContent = 'Manage Orders';
                manageOrdersLink.classList.add('active');
                fetchAdminOrders();
            } else if (sectionId === 'manage-users') {
                manageUsersContent.style.display = 'block';
                adminContentTitle.textContent = 'Manage Users';
                manageUsersLink.classList.add('active');
                fetchAdminUsers();
            }
        }

        // Event Listeners for Sidebar Navigation
        if (dashboardLink) dashboardLink.addEventListener('click', (e) => { e.preventDefault(); showSection('dashboard-overview'); });
        if (manageOrdersLink) manageOrdersLink.addEventListener('click', (e) => { e.preventDefault(); showSection('manage-orders'); });
        if (manageUsersLink) manageUsersLink.addEventListener('click', (e) => { e.preventDefault(); showSection('manage-users'); });
        // Create User link redirects to admin_create_user.html, no need for showSection

        // --- Fetch Admin Dashboard Stats ---
        async function fetchDashboardStats() {
            try {
                const response = await fetch(`${API_BASE_URL}/api/admin/stats`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
                });
                const data = await response.json();
                if (response.ok && data.success) {
                    document.getElementById('total-orders').textContent = data.totalOrders;
                    document.getElementById('pending-orders').textContent = data.pendingOrders;
                    document.getElementById('completed-orders').textContent = data.completedOrders;
                } else {
                    console.error('DEBUG: Failed to fetch dashboard stats:', data.message || 'Error');
                    alert('Gagal memuat statistik dashboard: ' + (data.message || 'Error'));
                }
            } catch (error) {
                console.error('DEBUG: Error fetching dashboard stats:', error);
                alert('Terjadi masalah jaringan saat memuat statistik dashboard.');
            }
        }

        // --- Fetch Admin Orders ---
        async function fetchAdminOrders() {
            const adminOrdersTableBody = document.getElementById('admin-orders-table-body');
            adminOrdersTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Loading orders...</td></tr>';
            try {
                const response = await fetch(`${API_BASE_URL}/api/admin/orders`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
                });
                const data = await response.json();
                if (response.ok && data.success) {
                    adminOrdersTableBody.innerHTML = '';
                    if (data.orders && data.orders.length > 0) {
                        data.orders.forEach(order => {
                            const row = `
                                <tr>
                                    <td>${order.orderId}</td>
                                    <td>${order.customerName || order.username}</td>
                                    <td>${order.serviceType}</td>
                                    <td>${order.imei}</td>
                                    <td>Rp ${order.amount ? order.amount.toLocaleString('id-ID') : 'N/A'}</td>
                                    <td>
                                        <button class="status-button status-${order.status.toLowerCase()}" data-order-id="${order.orderId}" data-current-status="${order.status}">
                                            ${order.status}
                                        </button>
                                    </td>
                                    <td>
                                        <select class="admin-status-select" data-order-id="${order.orderId}">
                                            <option value="">Update Status</option>
                                            <option value="Menunggu Pembayaran" ${order.status === 'Menunggu Pembayaran' ? 'selected' : ''}>Menunggu Pembayaran</option>
                                            <option value="Diproses" ${order.status === 'Diproses' ? 'selected' : ''}>Diproses</option>
                                            <option value="Selesai" ${order.status === 'Selesai' ? 'selected' : ''}>Selesai</option>
                                            <option value="Dibatalkan" ${order.status === 'Dibatalkan' ? 'selected' : ''}>Dibatalkan</option>
                                        </select>
                                    </td>
                                </tr>
                            `;
                            adminOrdersTableBody.innerHTML += row;
                        });
                        // Add event listeners for status select dropdowns
                        document.querySelectorAll('.admin-status-select').forEach(select => {
                            select.addEventListener('change', async (e) => {
                                const orderId = e.target.dataset.orderId;
                                const newStatus = e.target.value;
                                if (newStatus && orderId) {
                                    await updateOrderStatusAdmin(orderId, newStatus);
                                    e.target.value = ''; // Reset dropdown
                                }
                            });
                        });
                    } else {
                        adminOrdersTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--secondary-text-color);">No orders found.</td></tr>';
                    }
                } else {
                    console.error('DEBUG: Failed to fetch admin orders:', data.message || 'Error');
                    adminOrdersTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">Failed to load orders: ${data.message || 'Error'}</td></tr>`;
                }
            } catch (error) {
                console.error('DEBUG: Error fetching admin orders:', error);
                adminOrdersTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">Network error loading orders.</td></tr>`;
            }
        }

        // --- Fetch Admin Users ---
        async function fetchAdminUsers() {
            const adminUsersTableBody = document.getElementById('admin-users-table-body');
            adminUsersTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center;">Loading users...</td></tr>';
            try {
                const response = await fetch(`${API_BASE_URL}/api/admin/users`, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
                });
                const data = await response.json();
                if (response.ok && data.success) {
                    adminUsersTableBody.innerHTML = '';
                    if (data.users && data.users.length > 0) {
                        data.users.forEach(user => {
                            const row = `
                                <tr>
                                    <td>${user.username}</td>
                                    <td>${user.name || 'N/A'}</td>
                                    <td>${user.email || 'N/A'}</td>
                                    <td>${user.id}</td>
                                    <td>
                                        <button class="status-button status-${user.is_admin ? 'completed' : 'unknown'}" data-user-id="${user.id}" data-is-admin="${user.is_admin}">
                                            ${user.is_admin ? 'Admin' : 'User'}
                                        </button>
                                        <!-- Opsi untuk mengubah peran admin atau menghapus user bisa ditambahkan di sini -->
                                    </td>
                                </tr>
                            `;
                            adminUsersTableBody.innerHTML += row;
                        });
                    } else {
                        adminUsersTableBody.innerHTML = '<tr><td colspan="5" style="text-align: center; color: var(--secondary-text-color);">No users found.</td></tr>';
                    }
                } else {
                    console.error('DEBUG: Failed to fetch admin users:', data.message || 'Error');
                    adminUsersTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: red;">Failed to load users: ${data.message || 'Error'}</td></tr>`;
                }
            } catch (error) {
                console.error('DEBUG: Error fetching admin users:', error);
                adminUsersTableBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: red;">Network error loading users.</td></tr>`;
            }
        }

        // --- Update Order Status via Admin Dashboard ---
        async function updateOrderStatusAdmin(orderId, newStatus) {
            if (!confirm(`Are you sure you want to update order ${orderId} to ${newStatus}?`)) {
                return; // Batalkan jika admin tidak yakin
            }
            try {
                const response = await fetch(`${API_BASE_URL}/api/admin/update-order-status`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('authToken')}` // Authenticate admin
                    },
                    body: JSON.stringify({ orderId, newStatus, initiator: localStorage.getItem('userName') || 'Admin' })
                });
                const data = await response.json();
                if (response.ok && data.success) {
                    alert(`Order ${orderId} updated to ${newStatus} successfully!`);
                    fetchAdminOrders(); // Reload orders table
                } else {
                    alert(`Failed to update order ${orderId}: ${data.message || 'Error'}`);
                    console.error('DEBUG: Failed to update order status:', data.message || 'Error');
                }
            } catch (error) {
                alert(`Network error updating order ${orderId}.`);
                console.error('DEBUG: Network error updating order status:', error);
            }
        }


        // Initialize dashboard view
        showSection('dashboard-overview');
    }
    // --- End Admin Dashboard Logic ---


    // My Orders Page (Actual Data Fetching after successful authentication check)
    if (currentPage === 'my-orders.html' && localStorage.getItem('authToken') && localStorage.getItem('userId')) {
        const orderListDiv = document.getElementById('order-list');
        const token = localStorage.getItem('authToken');
        const userId = localStorage.getItem('userId');

        const fetchOrders = async () => {
            orderListDiv.innerHTML = '<p style="color: var(--secondary-text-color);">Memuat pesanan Anda...</p>';
            try {
                const response = await fetch(`${API_BASE_URL}/api/orders/${userId}`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                const data = await response.json();

                if (response.ok) {
                    if (data.orders && data.orders.length > 0) {
                        orderListDiv.innerHTML = '';
                        data.orders.forEach(order => {
                            orderListDiv.innerHTML += `
                                <div class="service-card content-container-card" style="text-align: left;">
                                    <h3>Order ID: ${order.orderId}</h3>
                                    <p style="color: var(--secondary-text-color);"><strong>Layanan:</strong> ${order.serviceType}</p>
                                    <p style="color: var(--secondary-text-color);"><strong>IMEI:</strong> ${order.imei}</p>
                                    <p style="color: var(--secondary-text-color);"><strong>Status:</strong> <span style="font-weight: bold; color: ${order.status === 'Selesai' ? 'green' : order.status === 'Diproses' ? 'orange' : 'grey'};">${order.status}</span></p>
                                    <p style="color: var(--secondary-text-color);"><strong>Metode Pembayaran:</strong> ${order.paymentMethod}</p>
                                    <p style="font-size: 0.8em; color: var(--secondary-text-color);">Tanggal Pesan: ${new Date(order.orderDate).toLocaleDateString()} ${new Date(order.orderDate).toLocaleTimeString()}</p>
                                    <p style="font-size: 0.9em; color: var(--secondary-text-color);">Total Bayar: <strong>Rp ${order.amount ? order.amount.toLocaleString('id-ID') : 'N/A'}</strong></p> <!-- Tampilkan jumlah pembayaran -->
                                </div>
                            `;
                        });
                    } else {
                        orderListDiv.innerHTML = '<p style="color: var(--secondary-text-color);">Anda belum memiliki pesanan.</p>';
                    }
                } else {
                    const errorMessage = data.message || 'Terjadi kesalahan.';
                    console.error('DEBUG: Failed to load orders from API:', errorMessage);
                    orderListDiv.innerHTML = `<p style="color: red;">Gagal memuat pesanan: ${errorMessage}</p>`;
                }
            } catch (error) {
                console.error('DEBUG: Error fetching orders (fetch failed/network issue):', error);
                orderListDiv.innerHTML = `<p style="color: red;">Terjadi masalah jaringan atau server saat memuat pesanan.</p>`;
            }
        };

        fetchOrders();
    }
});