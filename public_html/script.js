document.addEventListener('DOMContentLoaded', () => {
    // --- PENTING: GANTI DENGAN URL API BACKEND ANDA SAAT DEPLOY! ---
    // Pastikan ini sesuai dengan port backend Anda di backend/.env
    const API_BASE_URL = 'http://localhost:3002'; // Contoh: http://localhost:3000 atau http://localhost:3002

    // --- LOGIKA PROTEKSI HALAMAN ---
    // Fungsi untuk mendapatkan nama file HTML saat ini dari URL
    const getCurrentPageName = () => {
        const path = window.location.pathname;
        // Mengambil bagian terakhir setelah '/' dan menghapus parameter query
        return path.substring(path.lastIndexOf('/') + 1).split('?')[0];
    };
    const currentPage = getCurrentPageName();

    // PROTEKSI HALAMAN ORDER.HTML
    if (currentPage === 'order.html') {
        const authToken = localStorage.getItem('authToken');
        if (!authToken) {
            // Pengguna belum login, arahkan ke halaman login
            localStorage.setItem('redirectAfterLogin', window.location.href); // Simpan URL untuk redirect setelah login
            window.location.href = 'login.html';
            return; // Hentikan eksekusi script selanjutnya untuk halaman ini
        }
    }

    // PROTEKSI HALAMAN MY-ORDERS.HTML
    if (currentPage === 'my-orders.html') {
        const authToken = localStorage.getItem('authToken');
        const userId = localStorage.getItem('userId');
        if (!authToken || !userId) {
            localStorage.setItem('redirectAfterLogin', window.location.href);
            window.location.href = 'login.html'; // <--- LANGSUNG REDIRECT DI SINI
            return; // Hentikan eksekusi jika dialihkan
        }
    }
    // --- AKHIR LOGIKA PROTEKSI ---


    // Theme Toggle (Applies to all pages)
    const themeToggle = document.querySelector('.theme-toggle');
    const body = document.body;

    // Pastikan tombol themeToggle ada sebelum mencoba menggunakannya
    if (themeToggle) {
        const savedTheme = localStorage.getItem('theme');
        if (savedTheme === 'dark-mode') {
            body.classList.add('dark-mode');
            themeToggle.textContent = 'Mode Terang';
        } else {
            themeToggle.textContent = 'Mode Gelap';
        }

        themeToggle.addEventListener('click', () => {
            body.classList.toggle('dark-mode');
            if (body.classList.contains('dark-mode')) {
                themeToggle.textContent = 'Mode Terang';
                localStorage.setItem('theme', 'dark-mode');
            } else {
                localStorage.setItem('theme', 'light-mode');
            }
        });
    }

    // --- Manajemen Status Login di Navbar ---
    const navLoginRegister = document.getElementById('nav-login-register');
    const navUserGreeting = document.getElementById('nav-user-greeting');
    const usernameDisplay = document.getElementById('username-display');
    const logoutBtnNavbar = document.getElementById('logout-btn-navbar');
    
    // Ambil token dan nama pengguna saat DOM Content Loaded
    const authTokenOnLoad = localStorage.getItem('authToken');
    const userNameOnLoad = localStorage.getItem('userName');

    if (authTokenOnLoad && userNameOnLoad) {
        if (navLoginRegister) navLoginRegister.style.display = 'none';
        if (navUserGreeting) {
            navUserGreeting.style.display = 'list-item'; // Atau 'block'/'inline-block' tergantung layout Anda
            if (usernameDisplay) usernameDisplay.textContent = userNameOnLoad;
        }
        if (logoutBtnNavbar) logoutBtnNavbar.style.display = 'block'; // Tampilkan tombol logout
    } else {
        if (navLoginRegister) navLoginRegister.style.display = 'block'; // Tampilkan login/daftar
        if (navUserGreeting) navUserGreeting.style.display = 'none';
        if (logoutBtnNavbar) logoutBtnNavbar.style.display = 'none'; // PERBAIKAN DI SINI
    }

    // Event Listener untuk Logout Button di Navbar (Global)
    if (logoutBtnNavbar) {
        logoutBtnNavbar.addEventListener('click', () => {
            localStorage.removeItem('authToken');
            localStorage.removeItem('userId');
            localStorage.removeItem('userName'); // Hapus juga nama pengguna
            window.location.href = 'login.html'; // Redirect ke halaman login setelah logout
        });
    }
    // --- Akhir Manajemen Status Login ---


    // --- Page-specific JavaScript Logic (akan dieksekusi hanya jika tidak dire-redirect) ---

    // Order and Payment Submission (Only on order.html)
    const orderForm = document.getElementById('order-submission-form');
    // console.log('DEBUG: orderForm element found:', orderForm); // Debug log
    
    if (orderForm) {
        const orderStatusDiv = document.getElementById('order-status');
        // console.log('DEBUG: orderStatusDiv element found:', orderStatusDiv); // Debug log

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
            // console.log('DEBUG: Order form submit event triggered.'); // Debug log
            e.preventDefault(); // Pastikan ini dieksekusi
            // console.log('DEBUG: Default form submission prevented.'); // Debug log

            orderStatusDiv.innerHTML = `<p style="color: var(--primary-blue);">Memproses pesanan Anda dan mengirimkan ke sistem kami...</p>`;
            
            const formData = new FormData(orderForm);
            const orderData = {};
            for (let [key, value] of formData.entries()) {
                orderData[key] = value;
            }
            // console.log('DEBUG: Order data collected:', orderData); // Debug log

            const userId = localStorage.getItem('userId');
            if (userId) {
                orderData.userId = userId;
            } else {
                console.error('DEBUG: User ID not found in localStorage during order submission. Redirection expected if not logged in.'); // DEBUG LOG 6
                orderStatusDiv.innerHTML = '<p style="color: red;">Error: Anda harus login untuk membuat pesanan. Silakan coba refresh halaman.</p>';
                return;
            }

            try {
                const targetApiUrl = `${API_BASE_URL}/api/order`; // INI PERBAIKAN UTAMA
                // console.log('DEBUG: Attempting to fetch API from:', targetApiUrl); // Debug log
                
                const response = await fetch(targetApiUrl, {
                    method: orderForm.method, // Ini tetap POST
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
                    },
                    body: JSON.stringify(orderData)
                });
                // console.log('DEBUG: API response received. Status:', response.status); // Debug log

                const contentType = response.headers.get('content-type');
                let result = {};
                if (contentType && contentType.includes('application/json')) {
                    result = await response.json();
                } else {
                    console.warn('DEBUG: API did not return JSON. Status:', response.status, 'Content-Type:', contentType);
                    result.message = await response.text() || `Response status: ${response.status}`;
                }
                // console.log('DEBUG: API response parsed (or text):', result); // DEBUG LOG 9

                if (response.ok) {
                    const selectedPaymentMethod = orderData.paymentMethod;

                    orderStatusDiv.innerHTML = `
                        <p style="color: green;">Pesanan Anda berhasil dibuat! Nomor Pesanan: <strong>${result.orderId}</strong></p>
                        <p>Detail pesanan telah dikirimkan ke Discord bot kami.</p>
                        <p style="font-size: 1.1em; margin-top: 20px; font-weight: bold;">Simulasi Pembayaran:</p>
                        <p>Metode pembayaran yang Anda pilih: <strong>${selectedPaymentMethod}</strong>.</p>
                        <p>Silakan lakukan transfer ke detail berikut:</p>
                        <ul style="list-style-type: none; padding-left: 0; text-align: left; margin: 15px auto; max-width: 300px;">
                            <li>Bank: Contoh Bank Anda</li>
                            <li>Nomor Rekening: 1234567890 (a/n Nama Anda/Bisnis)</li>
                            <li>Total Pembayaran: Rp. 100.000 (Contoh)</li>
                            <li>Keterangan: Order ID ${result.orderId}</li>
                        </ul>
                        <p>Kami akan segera menghubungi Anda melalui Discord/email setelah pembayaran terverifikasi.</p>
                        <p style="font-size: 0.9em; margin-top: 15px;">Terima kasih atas kepercayaan Anda!</p>
                        <p><a href="my-orders.html" class="btn" style="margin-top: 15px;">Lihat Status Pesanan Saya</a></p>
                    `;
                    orderStatusDiv.style.backgroundColor = '#e0ffe0';
                    orderStatusDiv.style.borderColor = '#008000';
                    orderStatusDiv.style.color = 'var(--dark-blue-text)';
                    
                    orderForm.reset();
                } else {
                    const errorMessage = result.message || `Gagal membuat pesanan. Status: ${response.status}.`;
                    console.error('DEBUG: API responded with an error:', errorMessage); // Debug log
                    orderStatusDiv.innerHTML = `<p style="color: red;">Terjadi kesalahan: ${errorMessage}</p>`;
                    orderStatusDiv.style.backgroundColor = '#ffe0e0';
                    orderStatusDiv.style.borderColor = '#ff0000';
                    orderStatusDiv.style.color = 'red';
                }
            } catch (error) {
                console.error('DEBUG: Error submitting order (fetch failed/network issue):', error); // Debug log
                orderStatusDiv.innerHTML = `<p style="color: red;">Terjadi masalah jaringan atau server. Pastikan backend berjalan dengan benar dan coba lagi nanti.</p>`;
                orderStatusDiv.style.backgroundColor = '#ffe0e0';
                orderStatusDiv.style.borderColor = '#ff0000';
                orderStatusDiv.style.color = 'red';
            }
        });
    }

    // Login functionality (Only on login.html)
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        const loginStatusDiv = document.getElementById('login-status');
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('login-email').value;
            const password = document.getElementById('login-password').value;

            loginStatusDiv.innerHTML = `<p style="color: var(--primary-blue);">Logging in...</p>`;

            try {
                const response = await fetch(`${API_BASE_URL}/api/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password })
                });
                const data = await response.json();

                if (response.ok && data.token && data.userName) {
                    localStorage.setItem('authToken', data.token);
                    localStorage.setItem('userId', data.userId);
                    localStorage.setItem('userName', data.userName);
                    loginStatusDiv.innerHTML = '<p style="color: green;">Login berhasil! Mengarahkan...</p>';
                    const redirectUrl = localStorage.getItem('redirectAfterLogin') || 'my-orders.html';
                    localStorage.removeItem('redirectAfterLogin');
                    window.location.href = redirectUrl; 
                } else {
                    const errorMessage = data.message || 'Login gagal. Email atau password salah.';
                    console.error('DEBUG: Login API responded with error:', errorMessage);
                    loginStatusDiv.innerHTML = `<p style="color: red;">${errorMessage}</p>`;
                    loginStatusDiv.style.backgroundColor = '#ffe0e0';
                    loginStatusDiv.style.borderColor = '#ff0000';
                    loginStatusDiv.style.color = 'red';
                }
            } catch (error) {
                console.error('DEBUG: Login error (fetch failed/network issue):', error);
                loginStatusDiv.innerHTML = '<p style="color: red;">Terjadi masalah jaringan atau server. Pastikan backend berjalan dengan benar dan coba lagi nanti.</p>';
                loginStatusDiv.style.backgroundColor = '#ffe0e0';
                loginStatusDiv.style.borderColor = '#ff0000';
                loginStatusDiv.style.color = 'red';
            }
        });
    }

    // Registration functionality (Only on register.html)
    const registerForm = document.getElementById('register-form');
    if (registerForm) {
        const registerStatusDiv = document.getElementById('register-status');
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('reg-name').value;
            const email = document.getElementById('reg-email').value;
            const password = document.getElementById('reg-password').value;
            const confirmPassword = document.getElementById('reg-confirm-password').value;

            if (password !== confirmPassword) {
                registerStatusDiv.innerHTML = '<p style="color: red;">Error: Password dan konfirmasi password tidak cocok.</p>';
                registerStatusDiv.style.backgroundColor = '#ffe0e0';
                registerStatusDiv.style.borderColor = '#ff0000';
                registerStatusDiv.style.color = 'red';
                return;
            }

            registerStatusDiv.innerHTML = `<p style="color: var(--primary-blue);">Mendaftar akun...</p>`;

            try {
                const response = await fetch(`${API_BASE_URL}/api/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name, email, password })
                });
                const data = await response.json();

                if (response.ok) {
                    registerStatusDiv.innerHTML = '<p style="color: green;">Pendaftaran berhasil! Anda dapat login sekarang.</p>';
                    registerStatusDiv.style.backgroundColor = '#e0ffe0';
                    registerStatusDiv.style.borderColor = '#008000';
                    registerStatusDiv.style.color = 'var(--dark-blue-text)';
                    registerForm.reset();
                    setTimeout(() => {
                        window.location.href = 'login.html';
                    }, 2000);
                } else {
                    const errorMessage = data.message || 'Pendaftaran gagal. Silakan coba lagi.';
                    console.error('DEBUG: Register API responded with error:', errorMessage);
                    registerStatusDiv.innerHTML = `<p style="color: red;">Terjadi kesalahan: ${errorMessage}</p>`;
                    registerStatusDiv.style.backgroundColor = '#ffe0e0';
                    registerStatusDiv.style.borderColor = '#ff0000';
                    registerStatusDiv.style.color = 'red';
                }
            } catch (error) {
                console.error('DEBUG: Registration error (fetch failed/network issue):', error);
                registerStatusDiv.innerHTML = '<p style="color: red;">Terjadi masalah jaringan atau server. Pastikan backend berjalan dengan benar dan coba lagi nanti.</p>';
                registerStatusDiv.style.backgroundColor = '#ffe0e0';
                registerStatusDiv.style.borderColor = '#ff0000';
                registerStatusDiv.style.color = 'red';
            }
        });
    }

    // My Orders Page (Actual Data Fetching after successful authentication check)
    if (currentPage === 'my-orders.html' && localStorage.getItem('authToken') && localStorage.getItem('userId')) {
        const orderListDiv = document.getElementById('order-list');
        const token = localStorage.getItem('authToken');
        const userId = localStorage.getItem('userId');

        const fetchOrders = async () => {
            orderListDiv.innerHTML = '<p>Memuat pesanan Anda...</p>';
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
                                <div class="service-card" style="text-align: left;">
                                    <h3>Order ID: ${order.orderId}</h3>
                                    <p><strong>Layanan:</strong> ${order.serviceType}</p>
                                    <p><strong>IMEI:</strong> ${order.imei}</p>
                                    <p><strong>Status:</strong> <span style="font-weight: bold; color: ${order.status === 'Selesai' ? 'green' : order.status === 'Diproses' ? 'orange' : 'grey'};">${order.status}</span></p>
                                    <p><strong>Metode Pembayaran:</strong> ${order.paymentMethod}</p>
                                    <p style="font-size: 0.8em; color: #777;">Tanggal Pesan: ${new Date(order.orderDate).toLocaleDateString()} ${new Date(order.orderDate).toLocaleTimeString()}</p>
                                </div>
                            `;
                        });
                    } else {
                        orderListDiv.innerHTML = '<p>Anda belum memiliki pesanan.</p>';
                    }
                } else {
                    const errorMessage = data.message || 'Terjadi kesalahan.';
                    console.error('DEBUG: Failed to load orders from API:', errorMessage);
                    orderListDiv.innerHTML = `<p style="color: red;">Gagal memuat pesanan: ${errorMessage}</p>`;
                }
            } catch (error) {
                console.error('DEBUG: Error fetching orders (fetch failed/network issue):', error);
                orderListDiv.innerHTML = '<p style="color: red;">Terjadi masalah jaringan atau server saat memuat pesanan.</p>';
            }
        };

        fetchOrders();
    }
});