document.addEventListener('DOMContentLoaded', () => {
    // --- PENTING: GANTI DENGAN URL API BACKEND ANDA SAAT DEPLOY! ---
    const API_BASE_URL = 'https://back.imeihub.id'; 

    // --- ADMIN API KEY (Ini akan digunakan oleh admin_create_user.html) ---
    const ADMIN_API_KEY = 'your_super_secret_admin_api_key_here'; // <-- GANTI INI DENGAN KUNCI RAHASIA ANDA

    // --- LOGIKA PROTEKSI HALAMAN ---
    const getCurrentPageName = () => {
        const path = window.location.pathname;
        let fileName = path.substring(path.lastIndexOf('/') + 1).split('?')[0];
        if (fileName.endsWith('.html')) {
            fileName = fileName.slice(0, -5);
        }
        return fileName;
    };
    const currentPage = getCurrentPageName();
    console.log(`DEBUG_FRONTEND: Current Page Name: "${currentPage}"`);


    const checkAuthAndAdminStatus = () => {
        const authToken = localStorage.getItem('authToken');
        const userId = localStorage.getItem('userId');
        const userName = localStorage.getItem('userName');
        const isAdmin = localStorage.getItem('isAdmin') === 'true';

        console.log(`DEBUG_FRONTEND: checkAuthAndAdminStatus - AuthToken: ${!!authToken}, UserId: ${userId}, UserName: ${userName}, IsAdmin: ${isAdmin}`);
        return { authToken, userId, userName, isAdmin };
    };

    if (currentPage === 'order') { 
        const { authToken } = checkAuthAndAdminStatus();
        if (!authToken) {
            localStorage.setItem('redirectAfterLogin', window.location.href);
            window.location.href = 'login.html';
            return;
        }
    }

    if (currentPage === 'my-orders') { 
        const { authToken, userId } = checkAuthAndAdminStatus();
        if (!authToken || !userId) {
            localStorage.setItem('redirectAfterLogin', window.location.href);
            window.location.href = 'login.html';
            return;
        }
    }

    if (currentPage.startsWith('admin_')) {
        const { authToken, isAdmin } = checkAuthAndAdminStatus();
        console.log(`DEBUG_FRONTEND: Accessing admin page (${currentPage}). AuthToken: ${!!authToken}, IsAdmin (from localStorage): ${isAdmin}`);
        if (!authToken || !isAdmin) {
            alert('Akses Ditolak: Anda harus login sebagai Admin.');
            localStorage.setItem('redirectAfterLogin', window.location.href);
            window.location.href = 'login.html';
            return;
        }
    }
    // --- AKHIR LOGIKA PROTEKSI ---


    // --- Manajemen Status Login di Navbar (Top & Mobile Overlay) ---
    // Deklarasikan semua elemen navbar di scope DOMContentLoaded agar selalu tersedia
    const navLoginRegister = document.getElementById('nav-login-register');
    const navUserGreeting = document.getElementById('nav-user-greeting');
    const usernameDisplay = document.getElementById('username-display');
    const logoutBtnNavbar = document.getElementById('logout-btn-navbar');
    const navAdminDashboard = document.getElementById('nav-admin-dashboard');
    
    const hamburgerMenu = document.querySelector('.hamburger-menu');
    const mobileNavOverlay = document.querySelector('.mobile-nav-overlay');
    const closeMobileNav = document.querySelector('.close-mobile-nav');
    const mobileNavLoginRegister = document.getElementById('mobile-nav-login-register');
    const mobileNavUserGreeting = document.getElementById('mobile-nav-user-greeting');
    const mobileUsernameDisplay = document.getElementById('mobile-username-display');
    const mobileLogoutBtn = document.getElementById('mobile-logout-btn');
    // Pastikan mobileNavAdminDashboard dideklarasikan di sini
    const mobileNavAdminDashboard = document.getElementById('mobile-nav-admin-dashboard'); 


    function updateNavbarLoginStatus() {
        const { authToken, userName, isAdmin } = checkAuthAndAdminStatus();

        console.log(`DEBUG_FRONTEND: Inside updateNavbarLoginStatus. AuthToken: ${!!authToken}, UserName: ${userName}, IsAdmin: ${isAdmin}`);
        
        // Desktop Navbar
        if (navLoginRegister) navLoginRegister.style.display = (authToken && userName) ? 'none' : 'block';
        if (navUserGreeting) {
            navUserGreeting.style.display = (authToken && userName) ? 'flex' : 'none';
            if (usernameDisplay) usernameDisplay.textContent = userName;
            console.log(`DEBUG_FRONTEND: Desktop Username Display Set: ${usernameDisplay ? usernameDisplay.textContent : 'N/A'}`);
        }
        if (logoutBtnNavbar) logoutBtnNavbar.style.display = (authToken && userName) ? 'block' : 'none';
        if (navAdminDashboard) navAdminDashboard.style.display = (authToken && userName && isAdmin) ? 'block' : 'none';
        console.log(`DEBUG_FRONTEND: Desktop Admin Dashboard Display Set: ${navAdminDashboard ? navAdminDashboard.style.display : 'N/A'}`);

        // Mobile Navbar
        if (mobileNavLoginRegister) mobileNavLoginRegister.style.display = (authToken && userName) ? 'none' : 'list-item';
        if (mobileNavUserGreeting) {
            mobileNavUserGreeting.style.display = (authToken && userName) ? 'list-item' : 'none';
            if (mobileUsernameDisplay) mobileUsernameDisplay.textContent = userName;
            console.log(`DEBUG_FRONTEND: Mobile Username Display Set: ${mobileUsernameDisplay ? mobileUsernameDisplay.textContent : 'N/A'}`);
        }
        if (mobileLogoutBtn) mobileLogoutBtn.style.display = (authToken && userName) ? 'block' : 'none';
        // Tambahkan null check untuk mobileNavAdminDashboard di sini
        if (mobileNavAdminDashboard) mobileNavAdminDashboard.style.display = (authToken && userName && isAdmin) ? 'list-item' : 'none';
        console.log(`DEBUG_FRONTEND: Mobile Admin Dashboard Display Set: ${mobileNavAdminDashboard ? mobileNavAdminDashboard.style.display : 'N/A'}`);

        // Pastikan elemen hamburgerMenu, mobileNavOverlay, closeMobileNav ada sebelum menambahkan event listener
        if (hamburgerMenu && mobileNavOverlay && closeMobileNav) {
            hamburgerMenu.addEventListener('click', () => {
                mobileNavOverlay.classList.toggle('open');
            });
            closeMobileNav.addEventListener('click', () => {
                mobileNavOverlay.classList.remove('open');
            });
            mobileNavOverlay.querySelectorAll('.mobile-nav-links a').forEach(link => {
                link.addEventListener('click', () => {
                    mobileNavOverlay.classList.remove('open');
                });
            });
        } else {
            console.warn('DEBUG_FRONTEND: Mobile navigation elements not found. Hamburger menu functionality may be limited.');
        }
    }
    updateNavbarLoginStatus();

    // Event Listener untuk Logout Button (Global)
    if (logoutBtnNavbar) {
        logoutBtnNavbar.addEventListener('click', () => {
            console.log('DEBUG_FRONTEND: Logout button clicked.');
            localStorage.clear();
            console.log('DEBUG_FRONTEND: LocalStorage cleared. AuthToken:', localStorage.getItem('authToken'));
            updateNavbarLoginStatus();
            window.location.href = 'login.html';
        });
    }
    // Event Listener untuk Logout Button Mobile
    if (mobileLogoutBtn) {
        mobileLogoutBtn.addEventListener('click', () => {
            console.log('DEBUG_FRONTEND: Mobile Logout button clicked.');
            localStorage.clear();
            updateNavbarLoginStatus();
            if (mobileNavOverlay) mobileNavOverlay.classList.remove('open');
            window.location.href = 'login.html';
        });
    }
    // --- Akhir Manajemen Status Login ---

    // --- Hamburger Menu Logic ---
    // --- End Hamburger Menu Logic ---


    // --- Page-specific JavaScript Logic ---

    // Order Submission (Only on order.html)
    const orderForm = document.getElementById('order-submission-form');
    const imeiCountInput = document.getElementById('imei-count');
    const imeiInputsContainer = document.getElementById('imei-inputs-container');

    // Fungsi untuk membuat input IMEI dinamis
    const createImeiInputs = (count) => {
        imeiInputsContainer.innerHTML = ''; // Clear existing inputs
        for (let i = 1; i <= count; i++) {
            const label = document.createElement('label');
            label.htmlFor = `imei-${i}`;
            label.textContent = `Device IMEI ${i}:`;
            imeiInputsContainer.appendChild(label);

            const input = document.createElement('input');
            input.type = 'text';
            input.id = `imei-${i}`;
            input.name = `imei_${i}`; // Name format: imei_1, imei_2
            input.maxLength = 15;
            input.required = true;
            imeiInputsContainer.appendChild(input);
        }
    };

    // Panggil sekali saat halaman dimuat untuk menampilkan 1 input IMEI default
    if (imeiCountInput) {
        createImeiInputs(parseInt(imeiCountInput.value, 10));
        imeiCountInput.addEventListener('input', (e) => {
            const count = parseInt(e.target.value, 10);
            if (count >= 1 && count <= 10) { // Batasi antara 1 dan 10
                createImeiInputs(count);
            } else if (count < 1) {
                e.target.value = 1;
                createImeiInputs(1);
            } else if (count > 10) {
                e.target.value = 10;
                createImeiInputs(10);
            }
        });
    }


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
                    case 'Permanent Unlock Android': serviceToSelect = 'Permanent Unlock IMEI Android'; break; 
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

            orderStatusDiv.innerHTML = `<p style="color: var(--accent-color);">Submitting your order...</p>`;
            orderStatusDiv.classList.remove('error');
            orderStatusDiv.style.backgroundColor = 'var(--card-bg)';
            orderStatusDiv.style.borderColor = 'var(--accent-color)';
            orderStatusDiv.style.color = 'var(--text-color)';
            
            const formData = new FormData(orderForm);
            const orderData = {
                serviceType: formData.get('serviceType'),
                imeis: [], // Ini akan menjadi array IMEI
            };

            // Kumpulkan semua IMEI dari input dinamis
            const imeiInputs = imeiInputsContainer.querySelectorAll('input[type="text"]');
            imeiInputs.forEach(input => {
                if (input.value) {
                    orderData.imeis.push(input.value);
                }
            });

            console.log('DEBUG: Order data collected for submission:', orderData);
            
            const { authToken, userId } = checkAuthAndAdminStatus();
            if (!authToken || !userId) {
                console.error('DEBUG: User not logged in or data missing during order submission.');
                orderStatusDiv.innerHTML = '<p style="color: red;">Error: Anda harus login untuk membuat pesanan.</p>';
                orderStatusDiv.classList.add('error');
                orderStatusDiv.style.backgroundColor = 'var(--card-bg)';
                orderStatusDiv.style.borderColor = 'red';
                orderStatusDiv.style.color = 'red';
                return;
            }
            orderData.userId = userId;

            try {
                const targetApiUrl = `${API_BASE_URL}/api/order/submit`;
                console.log('DEBUG: Attempting to fetch order submission API from:', targetApiUrl);
                console.log('DEBUG: Sending order payload:', orderData);

                const response = await fetch(targetApiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${authToken}`
                    },
                    body: JSON.stringify(orderData)
                });
                console.log('DEBUG: API response received. Status:', response.status);

                const contentType = response.headers.get('content-type');
                let result = {};
                if (contentType && contentType.includes('application/json')) {
                    result = await response.json();
                } else {
                    const errorText = await response.text();
                    console.warn('DEBUG: Order submission API did not return JSON. Status:', response.status, 'Content-Type:', contentType, 'Response Text:', errorText);
                    result.success = false;
                    result.message = errorText || `Response status: ${response.status}`;
                }
                console.log('DEBUG: API response parsed (or text):', result);

                if (response.ok && result.success) {
                    const totalAmount = result.orders.reduce((sum, order) => sum + (order.amount || 0), 0);
                    orderStatusDiv.innerHTML = `
                        <p style="color: green;">Pesanan Anda berhasil dibuat! Total ${result.orders.length} IMEI.</p>
                        <p style="color: var(--secondary-text-color);">Total Harga: <strong>Rp ${totalAmount.toLocaleString('id-ID')}</strong></p>
                        <p style="color: var(--secondary-text-color);">Detail pesanan telah kami terima.</p>
                        <p style="font-size: 0.9em; margin-top: 15px; color: var(--secondary-text-color);">Kami akan segera memproses pesanan Anda.</p>
                        <p><a href="my-orders.html" class="cta-button" style="margin-top: 15px;">Lihat Status Pesanan Saya</a></p>
                    `;
                    orderStatusDiv.style.backgroundColor = 'var(--card-bg)';
                    orderStatusDiv.style.borderColor = 'var(--accent-color)';
                    orderStatusDiv.style.color = 'var(--text-color)';
                    orderStatusDiv.classList.remove('error');
                    
                    orderForm.reset();
                    createImeiInputs(1); // Reset to 1 IMEI input
                } else {
                    const errorMessage = result.message || `Gagal membuat pesanan. Status: ${response.status}.`;
                    console.error('DEBUG: Order submission API responded with error:', errorMessage);
                    orderStatusDiv.innerHTML = `<p style="color: red;">Terjadi kesalahan: ${errorMessage}</p>`;
                    orderStatusDiv.classList.add('error');
                    orderStatusDiv.style.backgroundColor = 'var(--card-bg)';
                    orderStatusDiv.style.borderColor = 'red';
                    orderStatusDiv.style.color = 'red';
                }
            } catch (error) {
                console.error('DEBUG: Error submitting order (fetch failed/network issue):', error);
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
                    localStorage.setItem('isAdmin', String(data.isAdmin === true || data.isAdmin === 1)); 
                    console.log(`DEBUG_FRONTEND: Login successful. IsAdmin: ${data.isAdmin} (Stored as: ${localStorage.getItem('isAdmin')})`);
                    loginStatusDiv.innerHTML = '<p style="color: green;">Login berhasil! Mengarahkan...</p>';
                    loginStatusDiv.classList.remove('error');
                    loginStatusDiv.style.backgroundColor = 'var(--card-bg)';
                    loginStatusDiv.style.borderColor = 'var(--accent-color)';
                    loginStatusDiv.style.color = 'var(--text-color)';
                    
                    updateNavbarLoginStatus(); // Panggil updateNavbarLoginStatus setelah semua data disimpan

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
            const phone = document.getElementById('admin-phone').value; // Ambil phone
            const password = document.getElementById('admin-password').value;
            const token = localStorage.getItem('authToken');

            console.log("DEBUG: Retrieved token:", token);
            if (!token) {
                alert('Gagal: Anda belum login atau token tidak tersedia.');
                return;
            }

            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
                'x-admin-api-key': ADMIN_API_KEY
            };

            adminCreateUserStatusDiv.innerHTML = `<p style="color: var(--accent-color);">Creating user account...</p>`;
            adminCreateUserStatusDiv.classList.remove('error');
            adminCreateUserStatusDiv.style.backgroundColor = 'var(--card-bg)';
            adminCreateUserStatusDiv.style.borderColor = 'var(--accent-color)';
            adminCreateUserStatusDiv.style.color = 'var(--text-color)';

            try {
                const response = await fetch(`${API_BASE_URL}/api/admin/create-user`, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({ username, fullname, email, phone, password }), // Kirim phone
                    mode: 'cors',
                    credentials: 'omit'
                });

                const data = await response.json();

                if (response.ok) {
                    adminCreateUserStatusDiv.innerHTML = `<p style="color: green;">User "${username}" created successfully!</p>`;
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
    const createUserLink = document.getElementById('create-user-link');

    if (currentPage === 'admin_dashboard') { // Diubah dari admin_dashboard.html
        const isAdminCheck = localStorage.getItem('isAdmin') === 'true'; 
        console.log(`DEBUG_FRONTEND: Admin Dashboard access check. IsAdmin: ${isAdminCheck}`);
        if (!isAdminCheck) { 
            alert('Akses Ditolak: Anda harus login sebagai Admin.');
            localStorage.setItem('redirectAfterLogin', window.location.href);
            window.location.href = 'login.html';
            return;
        }

        function showSection(sectionId) {
            dashboardOverviewContent.style.display = 'none';
            manageOrdersContent.style.display = 'none';
            manageUsersContent.style.display = 'none';

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
        if (createUserLink) createUserLink.addEventListener('click', (e) => { e.preventDefault(); window.location.href = 'admin_create_user.html'; });

        // Event Listener for Sorting Dropdown
        const sortOrdersBySelect = document.getElementById('sort-orders-by');
        if (sortOrdersBySelect) {
            sortOrdersBySelect.addEventListener('change', () => {
                const searchOrdersInput = document.getElementById('search-orders-by');
                fetchAdminOrders(sortOrdersBySelect.value, searchOrdersInput ? searchOrdersInput.value : '');
            });
        }
        // Event Listener for Search Input
        const searchOrdersInput = document.getElementById('search-orders-by');
        if (searchOrdersInput) {
            searchOrdersInput.addEventListener('input', () => {
                const sortOrdersBySelect = document.getElementById('sort-orders-by');
                fetchAdminOrders(sortOrdersBySelect ? sortOrdersBySelect.value : 'order_date DESC', searchOrdersInput.value);
            });
        }


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
        async function fetchAdminOrders(sortBy = 'order_date DESC', searchName = '') {
            console.log(`DEBUG_FRONTEND: Fetching admin orders. SortBy: ${sortBy}, SearchName: ${searchName}`);
            const adminOrdersTableBody = document.getElementById('admin-orders-table-body');
            const totalDisplayedAmountSpan = document.getElementById('total-displayed-amount');
            adminOrdersTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Loading orders...</td></tr>';
            totalDisplayedAmountSpan.textContent = 'Rp 0';

            try {
                let url = `${API_BASE_URL}/api/admin/orders?sortBy=${encodeURIComponent(sortBy)}`;
                if (searchName) {
                    url += `&searchName=${encodeURIComponent(searchName)}`;
                }
                console.log('DEBUG_FRONTEND: Fetching orders from URL:', url);

                const response = await fetch(url, {
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken')}` }
                });
                const data = await response.json();

                if (response.ok && data.success) {
                    adminOrdersTableBody.innerHTML = '';
                    let totalAmountForDisplay = 0;

                    if (data.orders && data.orders.length > 0) {
                        const now = new Date();
                        const todayCutoffHour = 17; // 5 PM in 24-hour format
                        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
                        
                        let currentGroupDate = null;
                        let isTodayBusinessOrdersAdded = false;
                        let isTomorrowOrdersAdded = false;

                        data.orders.forEach(order => {
                            const orderDate = new Date(order.orderDate);
                            const orderDayStart = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate(), 0, 0, 0);

                            let groupHeader = '';

                            if (orderDayStart.toDateString() === todayStart.toDateString()) {
                                if (orderDate.getHours() >= 7 && orderDate.getHours() < todayCutoffHour) {
                                    if (!isTodayBusinessOrdersAdded) {
                                        groupHeader = `<tr class="order-group-header"><td colspan="7">Today's Orders (7 AM - 5 PM)</td></tr>`;
                                        isTodayBusinessOrdersAdded = true;
                                    }
                                } else {
                                    if (!isTomorrowOrdersAdded) {
                                        groupHeader = `<tr class="order-group-header"><td colspan="7">Tomorrow's Orders (After 5 PM Today / Before 7 AM Tomorrow)</td></tr>`;
                                        isTomorrowOrdersAdded = true;
                                    }
                                }
                            } else {
                                if (currentGroupDate === null || orderDayStart.toDateString() !== currentGroupDate.toDateString()) {
                                    groupHeader = `<tr class="order-group-header"><td colspan="7">${orderDayStart.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</td></tr>`;
                                    currentGroupDate = orderDayStart;
                                    isTodayBusinessOrdersAdded = false;
                                    isTomorrowOrdersAdded = false;
                                }
                            }

                            if (groupHeader) {
                                adminOrdersTableBody.innerHTML += groupHeader;
                            }

                            const isCancelled = order.status && order.status.toLowerCase() === 'dibatalkan';
                            if (!isCancelled) {
                                if (typeof order.amount === 'number') {
                                    totalAmountForDisplay += order.amount;
                                } else if (typeof order.amount === 'string') {
                                    const parsed = parseInt(order.amount.replace(/[^\d]/g, ''));
                                    if (!isNaN(parsed)) totalAmountForDisplay += parsed;
                                }
                            }

                            // const orderDate = new Date(order.orderDate);
                            const formattedDate = orderDate.toLocaleString('id-ID', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                            });

                            const row = `
                                <tr>
                                    <td>${order.orderId}</td>
                                    <td>${order.customerName || order.username}</td>
                                    <td>${order.serviceType}</td>
                                    <td>${order.imei}</td>
                                    <td>${formattedDate}</td>
                                    <td>
                                        <button class="status-button status-${order.status.toLowerCase().replace(/\s/g, '-')}" data-order-id="${order.orderId}" data-current-status="${order.status}">
                                            ${order.status}
                                        </button>
                                    </td>

                                    <td>
                                        <select class="admin-status-select" data-order-id="${order.orderId}">
                                            <option value="">Update Status</option>
                                            <option value="Menunggu Pembayaran" ${order.status === 'Menunggu Pembayaran' ? 'selected' : ''}>Menunggu Pembayaran</option>
                                            <option value="Menunggu Proses Besok" ${order.status === 'Menunggu Proses Besok' ? 'selected' : ''}>Menunggu Proses Besok</option>
                                            <option value="Diproses" ${order.status === 'Diproses' ? 'selected' : ''}>Diproses</option>
                                            <option value="Selesai" ${order.status === 'Selesai' ? 'selected' : ''}>Selesai</option>
                                            <option value="Dibatalkan" ${order.status === 'Dibatalkan' ? 'selected' : ''}>Dibatalkan</option>
                                            <option value="Waiting" ${order.status === 'Waiting' ? 'selected' : ''}>Waiting</option>
                                        </select>
                                    </td>
                                </tr>
                            `;
                            adminOrdersTableBody.innerHTML += row;

                        });
                        const totalDisplayedAmountSpan = document.getElementById('total-displayed-amount');
                        const dashboardAmountSpan = document.getElementById('total-displayed-amount-dashboard');

                        if (totalDisplayedAmountSpan) {
                        totalDisplayedAmountSpan.textContent = `Rp ${totalAmountForDisplay.toLocaleString('id-ID')}`;
                        }
                        if (dashboardAmountSpan) {
                        dashboardAmountSpan.textContent = `Rp ${totalAmountForDisplay.toLocaleString('id-ID')}`;
                        }

                        document.querySelectorAll('.admin-status-select').forEach(select => {
                            select.addEventListener('change', async (e) => {
                                const orderId = e.target.dataset.orderId;
                                const newStatus = e.target.value;
                                if (newStatus && orderId) {
                                    await updateOrderStatusAdmin(orderId, newStatus);
                                    e.target.value = '';
                                }
                            });
                        });
                    } else {
                        adminOrdersTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--secondary-text-color);">No orders found.</td></tr>';
                        totalDisplayedAmountSpan.textContent = 'Rp 0';
                    }
                } else {
                    console.error('DEBUG: Failed to fetch admin orders:', data.message || 'Error');
                    adminOrdersTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">Failed to load orders: ${data.message || 'Error'}</td></tr>`;
                    totalDisplayedAmountSpan.textContent = 'Rp 0';
                }
            } catch (error) {
                console.error('DEBUG: Error fetching admin orders:', error);
                adminOrdersTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">Network error loading orders.</td></tr>`;
                totalDisplayedAmountSpan.textContent = 'Rp 0';
            }
        }

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
                                        <select class="admin-role-select" data-user-id="${user.id}" data-current-role="${user.is_admin ? 'admin' : 'user'}">
                                            <option value="">Set Role</option>
                                            <option value="user" ${!user.is_admin ? 'selected' : ''}>User</option>
                                            <option value="admin" ${user.is_admin ? 'selected' : ''}>Admin</option>
                                        </select>
                                    </td>
                                    <td>
                                        <button class="delete-user-button" data-user-id="${user.id}" data-username="${user.username}" style="background-color: var(--status-cancelled-bg); color: var(--status-cancelled-text); padding: 5px 10px; border-radius: 5px; border: none; cursor: pointer;">Delete</button>
                                    </td>
                                </tr>
                            `;
                            adminUsersTableBody.innerHTML += row;
                        });
                        document.querySelectorAll('.admin-role-select').forEach(select => {
                            select.addEventListener('change', async (e) => {
                                const userId = e.target.dataset.userId;
                                const newRole = e.target.value;
                                if (newRole && userId) {
                                    await updateUserRoleAdmin(userId, newRole === 'admin');
                                    e.target.value = '';
                                }
                            });
                        });
                        document.querySelectorAll('.delete-user-button').forEach(button => {
                            button.addEventListener('click', async (e) => {
                                const userId = e.target.dataset.userId;
                                const username = e.target.dataset.username;
                                await deleteUserAdmin(userId, username);
                            });
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

        async function updateOrderStatusAdmin(orderId, newStatus) {
            if (!confirm(`Are you sure you want to update order ${orderId} to ${newStatus}?`)) {
                return;
            }
            try {
                const response = await fetch(`${API_BASE_URL}/api/admin/update-order-status`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                    },
                    body: JSON.stringify({ orderId, newStatus, initiator: localStorage.getItem('userName') || 'Admin' })
                });
                const data = await response.json();
                if (response.ok && data.success) {
                    alert(`Order ${orderId} updated to ${newStatus} successfully!`);
                    const currentSortBy = document.getElementById('sort-orders-by') ? document.getElementById('sort-orders-by').value : 'order_date DESC';
                    const currentSearchName = document.getElementById('search-orders-by') ? document.getElementById('search-orders-by').value : '';
                    fetchAdminOrders(currentSortBy, currentSearchName);
                } else {
                    alert(`Failed to update order ${orderId}: ${data.message || 'Error'}`);
                    console.error('DEBUG: Failed to update order status:', data.message || 'Error');
                }
            } catch (error) {
                alert(`Network error updating order ${orderId}.`);
                console.error('DEBUG: Network error updating order status:', error);
            }
        }

        // --- Update User Role (Admin/User) ---
        async function updateUserRoleAdmin(userId, isAdmin) {
            const roleText = isAdmin ? 'Admin' : 'User';
            if (!confirm(`Are you sure you want to set user ${userId} as ${roleText}?`)) {
                return;
            }
            try {
                console.log(`DEBUG_FRONTEND: Sending update user role request for userId: ${userId}, isAdmin: ${isAdmin}`);
                const response = await fetch(`${API_BASE_URL}/api/admin/users/update-role`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                    },
                    body: JSON.stringify({ userId, isAdmin })
                });
                const data = await response.json();
                if (response.ok && data.success) {
                    alert(`User ${userId} role updated to ${roleText} successfully!`);
                    fetchAdminUsers(); // Reload users table
                } else {
                    alert(`Failed to update user role for ${userId}: ${data.message || 'Error'}`);
                    console.error('DEBUG: Failed to update user role:', data.message || 'Error');
                }
            } catch (error) {
                alert(`Network error updating user role for ${userId}.`);
                console.error('DEBUG: Network error updating user role:', error);
            }
        }

        // --- Delete User (Admin) ---
        async function deleteUserAdmin(userId, username) {
            if (!confirm(`Are you sure you want to delete user "${username}" (ID: ${userId})? This action cannot be undone.`)) {
                return;
            }
            try {
                console.log(`DEBUG_FRONTEND: Sending delete user request for userId: ${userId}`);
                const response = await fetch(`${API_BASE_URL}/api/admin/users/${userId}`, {
                    method: 'DELETE',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                    }
                });
                const data = await response.json();
                if (response.ok && data.success) {
                    alert(`User "${username}" deleted successfully!`);
                    fetchAdminUsers(); // Reload users table
                } else {
                    alert(`Failed to delete user "${username}": ${data.message || 'Error'}`);
                    console.error('DEBUG: Failed to delete user:', data.message || 'Error');
                }
            } catch (error) {
                alert(`Network error deleting user "${username}".`);
                console.error('DEBUG: Network error deleting user:', error);
            }
        }

        showSection('dashboard-overview');
    }
    // --- End Admin Dashboard Logic ---


   // My Orders Page (Actual Data Fetching after successful authentication check)
    if (currentPage === 'my-orders') {
        // Target the tbody of the table, not the old div
        const myOrdersTableBody = document.getElementById('my-orders-table-body');
        const { authToken, userId } = checkAuthAndAdminStatus();

        const fetchOrders = async () => {
            myOrdersTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Memuat pesanan Anda...</td></tr>';
            
            try {
                console.log(`DEBUG_FRONTEND: Fetching user orders for userId: ${userId}`);
                const response = await fetch(`${API_BASE_URL}/api/orders/${userId}`, {
                    headers: {
                        'Authorization': `Bearer ${authToken}`
                    }
                });
                const data = await response.json();

                if (response.ok) {
                    myOrdersTableBody.innerHTML = ''; // Clear loading message

                    if (data.orders && data.orders.length > 0) {
                        data.orders.forEach(order => {
                            // Format the date
                            const orderDate = new Date(order.orderDate);
                            const formattedDate = orderDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
                            
                            // Determine status class
                            const statusClass = `status-${order.status.toLowerCase().replace(/\s/g, '-')}`;

                            const row = `
                                <tr>
                                    <td>${order.orderId}</td>
                                    <td>${order.serviceType}</td>
                                    <td>${order.imei}</td>
                                    <td>Rp ${order.amount ? order.amount.toLocaleString('id-ID') : 'N/A'}</td>
                                    <td><button class="status-button ${statusClass}">${order.status}</button></td>
                                    <td>${formattedDate}</td>
                                    <td>
                                        <button class="cancel-order-button" data-order-id="${order.orderId}" style="background-color: var(--status-dibatalkan-bg); color: var(--status-dibatalkan-text); padding: 5px 10px; border-radius: 5px; border: none; cursor: pointer;">Cancel</button>
                                    </td>
                                </tr>
                            `;
                            myOrdersTableBody.innerHTML += row;
                        });
                        // Attach event listeners for cancel buttons after all orders are rendered
                        document.querySelectorAll('.cancel-order-button').forEach(button => {
                            button.addEventListener('click', async (e) => {
                                const orderId = e.target.dataset.orderId;
                                await cancelOrderUser(orderId);
                            });
                        });
                    } else {
                        myOrdersTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; color: var(--secondary-text-color);">Anda belum memiliki pesanan.</td></tr>';
                    }
                } else {
                    const errorMessage = data.message || 'Terjadi kesalahan.';
                    console.error('DEBUG: Failed to load orders from API:', errorMessage);
                    myOrdersTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">Gagal memuat pesanan: ${errorMessage}</td></tr>`;
                }
            } catch (error) {
                console.error('DEBUG: Error fetching orders (fetch failed/network issue):', error);
                myOrdersTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">Terjadi masalah jaringan atau server saat memuat pesanan.</td></tr>`;
            }
        };

        // --- Cancel Order by User ---
        async function cancelOrderUser(orderId) {
            if (!confirm(`Are you sure you want to cancel order ${orderId}? This action cannot be undone.`)) {
                return;
            }
            try {
                console.log(`DEBUG_FRONTEND: Sending cancel order request for orderId: ${orderId}`);
                const response = await fetch(`${API_BASE_URL}/api/orders/cancel`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                    },
                    body: JSON.stringify({ orderId: orderId, newStatus: 'Dibatalkan' })
                });
                const data = await response.json();
                if (response.ok && data.success) {
                    alert(`Order ${orderId} cancelled successfully!`);
                    fetchOrders(); // Reload orders for user
                } else {
                    alert(`Failed to cancel order ${orderId}: ${data.message || 'Error'}`);
                    console.error('DEBUG: Failed to cancel order:', data.message || 'Error');
                }
            } catch (error) {
                alert(`Network error cancelling order ${orderId}.`);
                console.error('DEBUG: Network error cancelling order:', error);
            }
        }

        fetchOrders();
    }
});



    // Fallback jika tidak ditemukan bagian render orders
    setTimeout(() => {
      if (typeof attachInvoiceButtonsOnRender === 'function') {
        attachInvoiceButtonsOnRender();
      }
    }, 200);
    

// ==== INVOICE PDF GENERATOR ====
function generateProfessionalInvoicePDF(orders, user, invoiceId, invoiceDate) {
  const validOrders = orders.filter(o => o.status.toLowerCase() !== 'dibatalkan');
  const total = validOrders.reduce((sum, o) => sum + (o.amount || 0), 0);
  const rows = validOrders.map((order, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${order.serviceType}</td>
      <td>${order.imei}</td>
      <td>${order.status}</td>
      <td>Rp ${order.amount ? order.amount.toLocaleString('id-ID') : 'N/A'}</td>
    </tr>
  `).join('');

  const htmlContent = `
    <div style="font-family: Arial; padding: 40px; color: #333;">
      <h2>ImeiHub</h2>
      <p>Jl. Teknologi No. 88, Jakarta</p>
      <hr/>
      <h3>Invoice</h3>
      <p><strong>Invoice ID:</strong> ${invoiceId}</p>
      <p><strong>Customer:</strong> ${user}</p>
      <p><strong>Date:</strong> ${invoiceDate}</p>
      <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
        <thead>
          <tr style="background-color: #f0f0f0;">
            <th>No</th><th>Service</th><th>IMEI</th><th>Status</th><th>Price</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <h3 style="text-align:right">Total: Rp ${total.toLocaleString('id-ID')}</h3>
    </div>
  `;

  html2pdf().from(htmlContent).set({
    margin: 0.5,
    filename: `invoice-${invoiceId}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'in', format: 'a4', orientation: 'portrait' }
  }).save();
}

// ==== CLICK HANDLER ====
document.addEventListener('click', function (e) {
  if (e.target.classList.contains('generate-invoice-button')) {
    const group = e.target.dataset.group;
    const orders = window.adminGroupedOrders?.[group];
    if (!orders || orders.length === 0) {
      alert('Tidak ada order dalam grup ini.');
      return;
    }

    const invoiceId = 'INV-' + Date.now();
    const invoiceDate = new Date().toLocaleDateString('id-ID');
    const username = orders[0]?.username || orders[0]?.customerName || 'User';

    generateProfessionalInvoicePDF(orders, username, invoiceId, invoiceDate);
  }
});
