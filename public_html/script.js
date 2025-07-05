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
            // Mengganti alert dengan modal kustom atau pesan di UI
            displayMessage('Akses Ditolak: Anda harus login sebagai Admin.', 'error');
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
    const closeMobileNav = document.querySelector('.close-mobile-nav'); // Corrected ID
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
                // Mengganti alert dengan modal kustom atau pesan di UI
                displayMessage('Error: Anda harus login untuk membuat pesanan.', 'error', orderStatusDiv);
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
                    // Mengganti alert dengan modal kustom atau pesan di UI
                    displayMessage(`Terjadi kesalahan: ${errorMessage}`, 'error', orderStatusDiv);
                }
            } catch (error) {
                console.error('DEBUG: Error submitting order (fetch failed/network issue):', error);
                // Mengganti alert dengan modal kustom atau pesan di UI
                displayMessage(`Terjadi masalah jaringan atau server. Pastikan backend berjalan dengan benar dan coba lagi nanti.`, 'error', orderStatusDiv);
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
                    // Mengganti alert dengan modal kustom atau pesan di UI
                    displayMessage(`${errorMessage}`, 'error', loginStatusDiv);
                }
            } catch (error) {
                console.error('DEBUG: Login error (fetch failed/network issue):', error);
                // Mengganti alert dengan modal kustom atau pesan di UI
                displayMessage(`Terjadi masalah jaringan atau server. Pastikan backend berjalan dengan benar dan coba lagi nanti.`, 'error', loginStatusDiv);
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
                // Mengganti alert dengan modal kustom atau pesan di UI
                displayMessage('Gagal: Anda belum login atau token tidak tersedia.', 'error');
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
                    // Mengganti alert dengan modal kustom atau pesan di UI
                    displayMessage(`Error: ${errorMessage}`, 'error', adminCreateUserStatusDiv);
                }
            } catch (error) {
                console.error('DEBUG: Admin Create User error (fetch failed/network issue):', error);
                // Mengganti alert dengan modal kustom atau pesan di UI
                displayMessage(`Terjadi masalah jaringan atau server. Pastikan backend berjalan dengan benar dan coba lagi nanti.`, 'error', adminCreateUserStatusDiv);
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

    // Global variable to store grouped orders for invoice generation
    window.adminGroupedOrders = {}; 

    if (currentPage === 'admin_dashboard') { // Diubah dari admin_dashboard.html
        const isAdminCheck = localStorage.getItem('isAdmin') === 'true'; 
        console.log(`DEBUG_FRONTEND: Admin Dashboard access check. IsAdmin: ${isAdminCheck}`);
        if (!isAdminCheck) { 
            // Mengganti alert dengan modal kustom atau pesan di UI
            displayMessage('Akses Ditolak: Anda harus login sebagai Admin.', 'error');
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
                    document.getElementById('total-displayed-amount-dashboard').textContent = `Rp ${data.totalRevenue ? data.totalRevenue.toLocaleString('id-ID') : '0'}`;
                } else {
                    console.error('DEBUG: Failed to fetch dashboard stats:', data.message || 'Error');
                    // Mengganti alert dengan modal kustom atau pesan di UI
                    displayMessage('Gagal memuat statistik dashboard: ' + (data.message || 'Error'), 'error');
                }
            } catch (error) {
                console.error('DEBUG: Error fetching dashboard stats:', error);
                // Mengganti alert dengan modal kustom atau pesan di UI
                displayMessage('Terjadi masalah jaringan saat memuat statistik dashboard.', 'error');
            }
        }

        // --- Fetch Admin Orders ---
        async function fetchAdminOrders(sortBy = 'order_date DESC', searchName = '') {
            console.log(`DEBUG_FRONTEND: Fetching admin orders. SortBy: ${sortBy}, SearchName: ${searchName}`);
            const adminOrdersTableBody = document.getElementById('admin-orders-table-body');
            const totalDisplayedAmountSpan = document.getElementById('total-displayed-amount');
            adminOrdersTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center;">Loading orders...</td></tr>';
            totalDisplayedAmountSpan.textContent = 'Rp 0';
            window.adminGroupedOrders = {}; // Reset grouped orders

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
                        
                        let currentGroupKey = null;
                        
                        // Sort orders by date for consistent grouping
                        data.orders.sort((a, b) => new Date(b.orderDate) - new Date(a.orderDate));

                        data.orders.forEach(order => {
                            const orderDate = new Date(order.orderDate);
                            const orderDayStart = new Date(orderDate.getFullYear(), orderDate.getMonth(), orderDate.getDate(), 0, 0, 0);
                            
                            let groupHeaderContent = '';
                            let groupKey = '';

                            if (orderDayStart.toDateString() === todayStart.toDateString()) {
                                if (orderDate.getHours() >= 7 && orderDate.getHours() < todayCutoffHour) {
                                    groupHeaderContent = "Today's Orders (7 AM - 5 PM)";
                                    groupKey = 'today-business-orders';
                                } else {
                                    groupHeaderContent = "Tomorrow's Orders (After 5 PM Today / Before 7 AM Tomorrow)";
                                    groupKey = 'tomorrow-orders';
                                }
                            } else {
                                groupHeaderContent = orderDayStart.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
                                groupKey = orderDayStart.toISOString().split('T')[0]; //YYYY-MM-DD
                            }

                            if (currentGroupKey !== groupKey) {
                                adminOrdersTableBody.innerHTML += `
                                    <tr class="order-group-header">
                                        <td colspan="7">
                                            ${groupHeaderContent}
                                            <button class="generate-invoice-button" data-group="${groupKey}"
                                            style="margin-left: 12px; padding: 6px 12px; background: #4f46e5; color: white; border: none; border-radius: 4px; cursor: pointer;">
                                            🧾 Generate Invoice
                                            </button>
                                        </td>
                                    </tr>
                                `;
                                currentGroupKey = groupKey;
                                window.adminGroupedOrders[groupKey] = []; // Initialize array for this group
                            }

                            // Add order to the current group
                            window.adminGroupedOrders[groupKey].push(order);

                            const isCancelled = order.status && order.status.toLowerCase() === 'dibatalkan';
                            if (!isCancelled) {
                                if (typeof order.amount === 'number') {
                                    totalAmountForDisplay += order.amount;
                                } else if (typeof order.amount === 'string') {
                                    const parsed = parseInt(order.amount.replace(/[^\d]/g, ''));
                                    if (!isNaN(parsed)) totalAmountForDisplay += parsed;
                                }
                            }

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

                        const totalDisplayedAmountSpanElement = document.getElementById('total-displayed-amount');
                        const dashboardAmountSpanElement = document.getElementById('total-displayed-amount-dashboard');

                        if (totalDisplayedAmountSpanElement) {
                            totalDisplayedAmountSpanElement.textContent = `Rp ${totalAmountForDisplay.toLocaleString('id-ID')}`;
                        }
                        if (dashboardAmountSpanElement) {
                            dashboardAmountSpanElement.textContent = `Rp ${totalAmountForDisplay.toLocaleString('id-ID')}`;
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
                                        <button class="delete-user-button" data-user-id="${user.id}" data-username="${user.username}" style="background-color: var(--status-dibatalkan-bg); color: var(--status-dibatalkan-text); padding: 5px 10px; border-radius: 5px; border: none; cursor: pointer;">Delete</button>
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
            // Mengganti confirm dengan modal kustom atau pesan di UI
            if (!await showConfirmation(`Are you sure you want to update order ${orderId} to ${newStatus}?`)) {
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
                    // Mengganti alert dengan modal kustom atau pesan di UI
                    displayMessage(`Order ${orderId} updated to ${newStatus} successfully!`, 'success');
                    const currentSortBy = document.getElementById('sort-orders-by') ? document.getElementById('sort-orders-by').value : 'order_date DESC';
                    const currentSearchName = document.getElementById('search-orders-by') ? document.getElementById('search-orders-by').value : '';
                    fetchAdminOrders(currentSortBy, currentSearchName);
                } else {
                    // Mengganti alert dengan modal kustom atau pesan di UI
                    displayMessage(`Failed to update order ${orderId}: ${data.message || 'Error'}`, 'error');
                    console.error('DEBUG: Failed to update order status:', data.message || 'Error');
                }
            } catch (error) {
                // Mengganti alert dengan modal kustom atau pesan di UI
                displayMessage(`Network error updating order ${orderId}.`, 'error');
                console.error('DEBUG: Network error updating order status:', error);
            }
        }

        // --- Update User Role (Admin/User) ---
        async function updateUserRoleAdmin(userId, isAdmin) {
            const roleText = isAdmin ? 'Admin' : 'User';
            // Mengganti confirm dengan modal kustom atau pesan di UI
            if (!await showConfirmation(`Are you sure you want to set user ${userId} as ${roleText}?`)) {
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
                    // Mengganti alert dengan modal kustom atau pesan di UI
                    displayMessage(`User ${userId} role updated to ${roleText} successfully!`, 'success');
                    fetchAdminUsers(); // Reload users table
                } else {
                    // Mengganti alert dengan modal kustom atau pesan di UI
                    displayMessage(`Failed to update user role for ${userId}: ${data.message || 'Error'}`, 'error');
                    console.error('DEBUG: Failed to update user role:', data.message || 'Error');
                }
            } catch (error) {
                // Mengganti alert dengan modal kustom atau pesan di UI
                displayMessage(`Network error updating user role for ${userId}.`, 'error');
                console.error('DEBUG: Network error updating user role:', error);
            }
        }

        // --- Delete User (Admin) ---
        async function deleteUserAdmin(userId, username) {
            // Mengganti confirm dengan modal kustom atau pesan di UI
            if (!await showConfirmation(`Are you sure you want to delete user "${username}" (ID: ${userId})? This action cannot be undone.`)) {
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
                    // Mengganti alert dengan modal kustom atau pesan di UI
                    displayMessage(`User "${username}" deleted successfully!`, 'success');
                    fetchAdminUsers(); // Reload users table
                } else {
                    // Mengganti alert dengan modal kustom atau pesan di UI
                    displayMessage(`Failed to delete user "${username}": ${data.message || 'Error'}`, 'error');
                    console.error('DEBUG: Failed to delete user:', data.message || 'Error');
                }
            } catch (error) {
                // Mengganti alert dengan modal kustom atau pesan di UI
                displayMessage(`Network error deleting user "${username}".`, 'error');
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
            // Mengganti confirm dengan modal kustom atau pesan di UI
            if (!await showConfirmation(`Are you sure you want to cancel order ${orderId}? This action cannot be undone.`)) {
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
                    // Mengganti alert dengan modal kustom atau pesan di UI
                    displayMessage(`Order ${orderId} cancelled successfully!`, 'success');
                    fetchOrders(); // Reload orders for user
                } else {
                    // Mengganti alert dengan modal kustom atau pesan di UI
                    displayMessage(`Failed to cancel order ${orderId}: ${data.message || 'Error'}`, 'error');
                    console.error('DEBUG: Failed to cancel order:', data.message || 'Error');
                }
            } catch (error) {
                // Mengganti alert dengan modal kustom atau pesan di UI
                displayMessage(`Network error cancelling order ${orderId}.`, 'error');
                console.error('DEBUG: Network error cancelling order:', error);
            }
        }

        fetchOrders();
    }
});


// ==== INVOICE PDF GENERATOR ====
function generateProfessionalInvoicePDF(orders, user, invoiceId, invoiceDate) {
  const validOrders = orders.filter(o => o.status.toLowerCase() !== 'dibatalkan');
  
  // Calculate totals
  const subTotal = validOrders.reduce((sum, o) => sum + (o.amount || 0), 0);
  const totalAmount = subTotal;

  // Generate table rows
  const rows = validOrders.map((order, index) => `
    <tr style="border-bottom: 1px solid #eee;">
      <td style="padding: 10px; text-align: left; font-size: 0.9em;">
        ${order.serviceType || 'N/A'}<br>
        <span style="color: #666; font-size: 0.8em;">IMEI: ${order.imei || 'N/A'}</span>
      </td>
      <td style="padding: 10px; text-align: right; font-size: 0.9em;">1</td>
      <td style="padding: 10px; text-align: right; font-size: 0.9em;">Rp ${order.amount ? order.amount.toLocaleString('id-ID') : '0'}</td>
      <td style="padding: 10px; text-align: right; font-size: 0.9em;">Rp ${order.amount ? order.amount.toLocaleString('id-ID') : '0'}</td>
    </tr>
  `).join('');

  const htmlContent = `
    <div style="font-family: 'Arial', sans-serif; padding: 40px; color: #333; max-width: 800px; margin: auto; background-color: #fff;">
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
            <tr>
                <td style="width: 50%; vertical-align: top;">
                    <div style="font-size: 2.5em; font-weight: bold; color: #555; margin-bottom: 15px;">INVOICE</div>
                    <div style="margin-bottom: 20px;">
                        <img src="imeihub_logo.png" alt="ImeiHub Logo" style="width: 80px; height: 80px; display: block; margin-bottom: 10px;">
                        <strong style="font-size: 1.2em; display: block; margin-bottom: 5px;">ImeiHub Company</strong>
                    </div>
                </td>
                <td style="width: 50%; vertical-align: top; text-align: right;">
                    <table style="width: 100%; text-align: right; font-size: 0.9em;">
                        <tr>
                            <td style="padding: 5px 0; color: #666;">Invoice#:</td>
                            <td style="padding: 5px 0; font-weight: bold;">${invoiceId}</td>
                        </tr>
                        <tr>
                            <td style="padding: 5px 0; color: #666;">Invoice Date:</td>
                            <td style="padding: 5px 0; font-weight: bold;">${invoiceDate}</td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
            <tr>
                <td style="width: 50%; vertical-align: top;">
                    <strong style="font-size: 1.1em; display: block; margin-bottom: 10px; color: #555;">BILL TO:</strong>
                    <span style="font-size: 1em; display: block; margin-bottom: 5px;">${user}</span>
                </td>
                <td style="width: 50%; vertical-align: top;"></td>
            </tr>
        </table>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px; border: 1px solid #eee;">
            <thead>
                <tr style="background-color: #f0f0f0;">
                    <th style="padding: 12px; text-align: left; font-size: 0.9em; color: #555;">ITEM DESCRIPTION</th>
                    <th style="padding: 12px; text-align: right; font-size: 0.9em; color: #555; width: 10%;">QTY</th>
                    <th style="padding: 12px; text-align: right; font-size: 0.9em; color: #555; width: 15%;">RATE</th>
                    <th style="padding: 12px; text-align: right; font-size: 0.9em; color: #555; width: 15%;">AMOUNT</th>
                </tr>
            </thead>
            <tbody>
                ${rows}
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 10px; text-align: left; font-size: 0.9em; color: #999;">Enter item name/description</td>
                    <td style="padding: 10px; text-align: right; font-size: 0.9em; color: #999;"></td>
                    <td style="padding: 10px; text-align: right; font-size: 0.9em; color: #999;"></td>
                    <td style="padding: 10px; text-align: right; font-size: 0.9em; color: #999;"></td>
                </tr>
            </tbody>
        </table>

        <table style="width: 100%; border-collapse: collapse;">
            <tr>
                <td style="width: 60%;"></td>
                <td style="width: 40%;">
                    <table style="width: 100%; border-collapse: collapse; text-align: right;">
                        <tr style="background-color: #f9f9f9;">
                            <td style="padding: 8px 12px; font-size: 0.95em; color: #555;">Sub Total</td>
                            <td style="padding: 8px 12px; font-size: 0.95em; font-weight: bold;">Rp ${subTotal.toLocaleString('id-ID')}</td>
                        </tr>
                        <tr style="background-color: #eee;">
                            <td style="padding: 12px; font-size: 1.1em; font-weight: bold; color: #333;">TOTAL</td>
                            <td style="padding: 12px; font-size: 1.1em; font-weight: bold; color: #333;">Rp ${totalAmount.toLocaleString('id-ID')}</td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>

        <!-- Bank Information Section -->
        <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd;">
            <strong style="font-size: 1em; color: #555;">Bank Transfer Information</strong>
            <p style="margin: 8px 0 0 0; font-size: 0.9em; color: #333;">
                <strong>BANK NAME:</strong> BCA<br>
                <strong>ACCOUNT NAME:</strong> I GEDE ADITYA DUAJA<br>
                <strong>ACCOUNT NO:</strong> 1460880218
            </p>
        </div>
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

// ==== CUSTOM MESSAGE/CONFIRMATION BOX ====
// Function to display custom messages (replaces alert)
function displayMessage(message, type = 'info', targetElement = null) {
    const messageDiv = document.createElement('div');
    messageDiv.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        padding: 15px 30px;
        border-radius: 8px;
        font-weight: bold;
        z-index: 10000;
        box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        animation: fadeOut 5s forwards;
        text-align: center;
    `;
    if (type === 'success') {
        messageDiv.style.backgroundColor = '#4CAF50';
        messageDiv.style.color = 'white';
    } else if (type === 'error') {
        messageDiv.style.backgroundColor = '#F44336';
        messageDiv.style.color = 'white';
    } else { // info
        messageDiv.style.backgroundColor = '#2196F3';
        messageDiv.style.color = 'white';
    }
    messageDiv.textContent = message;

    if (targetElement) {
        // If a target element is provided, append message there
        targetElement.innerHTML = ''; // Clear previous messages
        targetElement.appendChild(messageDiv);
        messageDiv.style.position = 'static'; // Make it flow with the document
        messageDiv.style.transform = 'none';
        messageDiv.style.margin = '20px auto';
    } else {
        document.body.appendChild(messageDiv);
    }

    // Add CSS for fadeOut animation
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes fadeOut {
            from { opacity: 1; }
            to { opacity: 0; display: none; }
        }
    `;
    document.head.appendChild(style);

    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.parentNode.removeChild(messageDiv);
        }
    }, 4000); // Message disappears after 4 seconds
}

// Function to display custom confirmation (replaces confirm)
function showConfirmation(message) {
    return new Promise((resolve) => {
        const modalOverlay = document.createElement('div');
        modalOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.6);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10001;
        `;

        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background-color: white;
            padding: 30px;
            border-radius: 10px;
            box-shadow: 0 5px 20px rgba(0, 0, 0, 0.3);
            text-align: center;
            max-width: 400px;
            width: 90%;
            color: var(--text-color-dark);
            font-family: 'Inter', sans-serif;
        `;

        const messageParagraph = document.createElement('p');
        messageParagraph.textContent = message;
        messageParagraph.style.marginBottom = '25px';
        messageParagraph.style.fontSize = '1.1em';
        messageParagraph.style.fontWeight = '600';

        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'center';
        buttonContainer.style.gap = '15px';

        const confirmButton = document.createElement('button');
        confirmButton.textContent = 'Yes';
        confirmButton.style.cssText = `
            padding: 10px 25px;
            background-color: #4CAF50;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 1em;
            font-weight: bold;
            transition: background-color 0.3s ease;
        `;
        confirmButton.onmouseover = () => confirmButton.style.backgroundColor = '#45a049';
        confirmButton.onmouseout = () => confirmButton.style.backgroundColor = '#4CAF50';
        confirmButton.addEventListener('click', () => {
            document.body.removeChild(modalOverlay);
            resolve(true);
        });

        const cancelButton = document.createElement('button');
        cancelButton.textContent = 'No';
        cancelButton.style.cssText = `
            padding: 10px 25px;
            background-color: #F44336;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 1em;
            font-weight: bold;
            transition: background-color 0.3s ease;
        `;
        cancelButton.onmouseover = () => cancelButton.style.backgroundColor = '#da190b';
        cancelButton.onmouseout = () => cancelButton.style.backgroundColor = '#F44336';
        cancelButton.addEventListener('click', () => {
            document.body.removeChild(modalOverlay);
            resolve(false);
        });

        buttonContainer.appendChild(confirmButton);
        buttonContainer.appendChild(cancelButton);
        modalContent.appendChild(messageParagraph);
        modalContent.appendChild(buttonContainer);
        modalOverlay.appendChild(modalContent);
        document.body.appendChild(modalOverlay);
    });
}

// ==== CLICK HANDLER FOR INVOICE BUTTONS ====
document.addEventListener('click', function (e) {
  if (e.target.classList.contains('generate-invoice-button')) {
    const group = e.target.dataset.group;
    const orders = window.adminGroupedOrders?.[group];
    if (!orders || orders.length === 0) {
      displayMessage('Tidak ada order dalam grup ini.', 'info');
      return;
    }

    const invoiceId = 'INV-' + Date.now();
    const invoiceDate = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); // Format date similar to image
    // Ambil nama pengguna dari order pertama di grup (asumsi semua order dalam grup ini milik satu pengguna)
    const username = orders[0]?.customerName || orders[0]?.username || 'User';

    generateProfessionalInvoicePDF(orders, username, invoiceId, invoiceDate);
  }
});
