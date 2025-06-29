document.addEventListener('DOMContentLoaded', () => {
    // --- PENTING: GANTI DENGAN URL API BACKEND ANDA SAAT DEPLOY! ---
const API_BASE_URL = 'https://admin.imeihub.id';

    // --- ADMIN API KEY (Ini akan digunakan oleh admin_create_user.html) ---
    // GANTI INI DENGAN API KEY YANG AMAN DAN HANYA DIKETAHUI OLEH ANDA!
    // IDEALNYA, INI JUGA HARUS DATANG DARI ENVIRONMENT VARIABLE DI FRONTEND
    const ADMIN_API_KEY = 'mafia_badung_paling_keren'; // <-- GANTI INI

    // --- LOGIKA PROTEKSI HALAMAN ---
    const getCurrentPageName = () => {
        const path = window.location.pathname;
        return path.substring(path.lastIndexOf('/') + 1).split('?')[0];
    };
    const currentPage = getCurrentPageName();

    if (currentPage === 'order.html') {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            localStorage.setItem('redirectAfterLogin', window.location.href);
            window.location.href = 'login.html';
            return;
        }
    }

    if (currentPage === 'my-orders.html') {
        const authToken = localStorage.getItem('authToken');
        const userId = localStorage.getItem('userId');
        if (!authToken || !userId) {
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
    
    const hamburgerMenu = document.querySelector('.hamburger-menu');
    const mobileNavOverlay = document.querySelector('.mobile-nav-overlay');
    const closeMobileNav = document.querySelector('.close-mobile-nav');
    const mobileNavLoginRegister = document.getElementById('mobile-nav-login-register');
    const mobileNavUserGreeting = document.getElementById('mobile-nav-user-greeting');
    const mobileUsernameDisplay = document.getElementById('mobile-username-display');
    const mobileLogoutBtn = document.getElementById('mobile-logout-btn');


    const authTokenOnLoad = localStorage.getItem('authToken');
    const userNameOnLoad = localStorage.getItem('userName');

    function updateNavbarLoginStatus() {
        if (authTokenOnLoad && userNameOnLoad) {
            // Desktop Navbar
            if (navLoginRegister) navLoginRegister.style.display = 'none';
            if (navUserGreeting) {
                navUserGreeting.style.display = 'flex';
                if (usernameDisplay) usernameDisplay.textContent = userNameOnLoad;
            }
            if (logoutBtnNavbar) logoutBtnNavbar.style.display = 'block';

            // Mobile Overlay Navbar
            if (mobileNavLoginRegister) mobileNavLoginRegister.style.display = 'none';
            if (mobileNavUserGreeting) {
                mobileNavUserGreeting.style.display = 'list-item';
                if (mobileUsernameDisplay) mobileUsernameDisplay.textContent = userNameOnLoad;
            }
            if (mobileLogoutBtn) mobileLogoutBtn.style.display = 'block';

        } else {
            // Desktop Navbar
            if (navLoginRegister) navLoginRegister.style.display = 'block';
            if (navUserGreeting) navUserGreeting.style.display = 'none';
            if (logoutBtnNavbar) logoutBtnNavbar.style.display = 'none';

            // Mobile Overlay Navbar
            if (mobileNavLoginRegister) mobileNavLoginRegister.style.display = 'list-item';
            if (mobileNavUserGreeting) mobileNavUserGreeting.style.display = 'none';
            if (mobileLogoutBtn) mobileLogoutBtn.style.display = 'none';
        }
    }
    updateNavbarLoginStatus();

    // Event Listener untuk Logout Button (Global)
    if (logoutBtnNavbar) {
        logoutBtnNavbar.addEventListener('click', () => {
            localStorage.removeItem('authToken');
            localStorage.removeItem('userId');
            localStorage.removeItem('userName');
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
    // Close overlay when a nav link is clicked
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
                    case 'iphone': serviceToSelect = 'Unlock IMEI iPhone'; break;
                    case 'android': serviceToSelect = 'Unlock IMEI Android'; break;
                    case 'global': serviceToSelect = 'Unlock IMEI Global'; break;
                    case 'history': serviceToSelect = 'Pemeriksaan Histori IMEI'; break;
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

            orderStatusDiv.innerHTML = `<p style="color: var(--accent-color);">Memproses pesanan Anda dan mengirimkan ke sistem kami...</p>`;
            orderStatusDiv.classList.remove('error');
            orderStatusDiv.style.backgroundColor = 'var(--card-bg)';
            orderStatusDiv.style.borderColor = 'var(--accent-color)';
            orderStatusDiv.style.color = 'var(--text-color)';
            
            const formData = new FormData(orderForm);
            const orderData = {};
            for (let [key, value] of formData.entries()) {
                orderData[key] = value;
            }
            console.log('DEBUG: Order data collected:', orderData);

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
                const targetApiUrl = `${API_BASE_URL}/api/order`;
                console.log('DEBUG: Attempting to fetch API from:', targetApiUrl);
                
                const response = await fetch(targetApiUrl, {
                    method: orderForm.method,
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                    },
                    body: JSON.stringify(orderData)
                });
                console.log('DEBUG: API response received. Status:', response.status);

                const contentType = response.headers.get('content-type');
                let result = {};
                if (contentType && contentType.includes('application/json')) {
                    result = await response.json();
                } else {
                    console.warn('DEBUG: API did not return JSON. Status:', response.status, 'Content-Type:', contentType);
                    result.message = await response.text() || `Response status: ${response.status}`;
                }
                console.log('DEBUG: API response parsed (or text):', result);

                if (response.ok) {
                    const selectedPaymentMethod = orderData.paymentMethod;

                    orderStatusDiv.innerHTML = `
                        <p style="color: green;">Pesanan Anda berhasil dibuat! Nomor Pesanan: <strong>${result.orderId}</strong></p>
                        <p style="color: var(--secondary-text-color);">Detail pesanan telah dikirimkan ke Discord bot kami.</p>
                        <p style="font-size: 1.1em; margin-top: 20px; font-weight: bold; color: var(--accent-color);">Simulasi Pembayaran:</p>
                        <p style="color: var(--secondary-text-color);">Metode pembayaran yang Anda pilih: <strong>${selectedPaymentMethod}</strong>.</p>
                        <p style="color: var(--secondary-text-color);">Silakan lakukan transfer ke detail berikut:</p>
                        <ul style="list-style-type: none; padding-left: 0; text-align: left; margin: 15px auto; max-width: 300px; color: var(--secondary-text-color);">
                            <li>Bank: Contoh Bank Anda</li>
                            <li>Nomor Rekening: 1234567890 (a/n Nama Anda/Bisnis)</li>
                            <li>Total Pembayaran: Rp. 100.000 (Contoh)</li>
                            <li>Keterangan: Order ID ${result.orderId}</li>
                        </ul>
                        <p style="color: var(--secondary-text-color);">Kami akan segera menghubungi Anda melalui Discord/email setelah pembayaran terverifikasi.</p>
                        <p style="font-size: 0.9em; margin-top: 15px; color: var(--secondary-text-color);">Terima kasih atas kepercayaan Anda!</p>
                        <p><a href="my-orders.html" class="cta-button" style="margin-top: 15px;">Lihat Status Pesanan Saya</a></p>
                    `;
                    orderStatusDiv.style.backgroundColor = 'var(--card-bg)';
                    orderStatusDiv.style.borderColor = 'var(--accent-color)';
                    orderStatusDiv.style.color = 'var(--text-color)';
                    orderStatusDiv.classList.remove('error');
                    
                    orderForm.reset();
                } else {
                    const errorMessage = result.message || `Gagal membuat pesanan. Status: ${response.status}.`;
                    console.error('DEBUG: API responded with an error:', errorMessage);
                    orderStatusDiv.innerHTML = `<p style="color: red;">Terjadi kesalahan: ${errorMessage}</p>`;
                    orderStatusDiv.style.backgroundColor = 'var(--card-bg)';
                    orderStatusDiv.style.borderColor = 'red';
                    orderStatusDiv.style.color = 'red';
                    orderStatusDiv.classList.add('error');
                }
            } catch (error) {
                console.error('DEBUG: Error submitting order (fetch failed/network issue):', error);
                orderStatusDiv.innerHTML = `<p style="color: red;">Terjadi masalah jaringan atau server. Pastikan backend berjalan dengan benar dan coba lagi nanti.</p>`;
                orderStatusDiv.style.backgroundColor = 'var(--card-bg)';
                orderStatusDiv.style.borderColor = 'red';
                orderStatusDiv.style.color = 'red';
                orderStatusDiv.classList.add('error');
            }
        });
    }

    // Login functionality (Only on login.html)
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        const loginStatusDiv = document.getElementById('login-status');
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('login-username').value; // Ambil username
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
                    body: JSON.stringify({ username, password }) // Kirim username, bukan email
                });
                const data = await response.json();

                if (response.ok && data.token && data.userName) {
                    localStorage.setItem('authToken', data.token);
                    localStorage.setItem('userId', data.userId);
                    localStorage.setItem('userName', data.userName);
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
                    const errorMessage = data.message || 'Login gagal. Username atau password salah.'; // Pesan error diubah
                    console.error('DEBUG: Login API responded with error:', errorMessage);
                    loginStatusDiv.innerHTML = `<p style="color: red;">${errorMessage}</p>`;
                    loginStatusDiv.style.backgroundColor = 'var(--card-bg)';
                    loginStatusDiv.style.borderColor = 'red';
                    loginStatusDiv.style.color = 'red';
                    loginStatusDiv.classList.add('error');
                }
            } catch (error) {
                console.error('DEBUG: Login error (fetch failed/network issue):', error);
                loginStatusDiv.innerHTML = `<p style="color: red;">Terjadi masalah jaringan atau server. Pastikan backend berjalan dengan benar dan coba lagi nanti.</p>`;
                loginStatusDiv.style.backgroundColor = 'var(--card-bg)';
                loginStatusDiv.style.borderColor = 'red';
                loginStatusDiv.style.color = 'red';
                loginStatusDiv.classList.add('error');
            }
        });
    }

    // Admin Create User functionality (Only on admin_create_user.html)
    const createUserForm = document.getElementById('create-user-form');
    if (createUserForm) {
        const adminCreateUserStatusDiv = document.getElementById('admin-create-user-status');
        createUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = document.getElementById('admin-username').value; // Ambil username
            const fullname = document.getElementById('admin-fullname').value; // Ambil fullname
            const email = document.getElementById('admin-email').value; // Ambil email
            const password = document.getElementById('admin-password').value;

            adminCreateUserStatusDiv.innerHTML = `<p style="color: var(--accent-color);">Creating user account...</p>`;
            adminCreateUserStatusDiv.classList.remove('error');
            adminCreateUserStatusDiv.style.backgroundColor = 'var(--card-bg)';
            adminCreateUserStatusDiv.style.borderColor = 'var(--accent-color)';
            adminCreateUserStatusDiv.style.color = 'var(--text-color)';

            // PENTING: Sertakan Admin API Key di header untuk autentikasi
            const headers = {
                'Content-Type': 'application/json',
                'X-Admin-API-Key': ADMIN_API_KEY
            };

            try {
                const response = await fetch(`${API_BASE_URL}/api/admin/create-user`, {
                    method: 'POST',
                    headers: headers,
                    body: JSON.stringify({ username, fullname, email, password }) // Kirim username, fullname, email
                });
                const data = await response.json();

                if (response.ok) {
                    adminCreateUserStatusDiv.innerHTML = `<p style="color: green;">User "${username}" created successfully!</p>`; // Pesan sukses pakai username
                    adminCreateUserStatusDiv.classList.remove('error');
                    adminCreateUserStatusDiv.style.backgroundColor = 'var(--card-bg)';
                    adminCreateUserStatusDiv.style.borderColor = 'var(--accent-color)';
                    adminCreateUserStatusDiv.style.color = 'var(--text-color)';
                    createUserForm.reset();
                } else {
                    const errorMessage = data.message || 'Failed to create user. Please try again.';
                    console.error('DEBUG: Admin Create User API responded with error:', errorMessage);
                    adminCreateUserStatusDiv.innerHTML = `<p style="color: red;">Error: ${errorMessage}</p>`;
                    adminCreateUserStatusDiv.style.backgroundColor = 'var(--card-bg)';
                    adminCreateUserStatusDiv.style.borderColor = 'red';
                    adminCreateUserStatusDiv.style.color = 'red';
                    adminCreateUserStatusDiv.classList.add('error');
                }
            } catch (error) {
                console.error('DEBUG: Admin Create User error (fetch failed/network issue):', error);
                adminCreateUserStatusDiv.innerHTML = `<p style="color: red;">Terjadi masalah jaringan atau server. Pastikan backend berjalan dengan benar dan coba lagi nanti.</p>`;
                adminCreateUserStatusDiv.style.backgroundColor = 'var(--card-bg)';
                adminCreateUserStatusDiv.style.borderColor = 'red';
                adminCreateUserStatusDiv.style.color = 'red';
                adminCreateUserStatusDiv.classList.add('error');
            }
        });
    }

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