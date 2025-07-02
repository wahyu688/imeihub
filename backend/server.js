require('dotenv').config(); // Memuat variabel lingkungan dari file .env
const express = require('express');
const bodyParser = require('body-parser'); // Middleware untuk mem-parse body request
const cors = require('cors'); // Middleware untuk Cross-Origin Resource Sharing
const jwt = require('jsonwebtoken'); // Library untuk JSON Web Tokens
const bcrypt = require('bcryptjs'); // Library untuk hashing password
const { v4: uuidv4 } = require('uuid'); // Library untuk menghasilkan UUID
const fetch = require('node-fetch'); // Untuk melakukan HTTP requests
const crypto = require('crypto'); // Modul bawaan Node.js untuk kriptografi
const nodemailer = require('nodemailer'); // Library untuk mengirim email

const app = express();
const PORT = process.env.PORT || 3000; // Port server dari variabel lingkungan atau default 3000
const JWT_SECRET = process.env.JWT_SECRET; // Secret key untuk JWT dari variabel lingkungan
const ADMIN_API_KEY_BACKEND = process.env.ADMIN_API_KEY_BACKEND; // API Key untuk endpoint admin

// --- Discord Configurations (Konstanta tetap ada, tapi tidak digunakan dalam logika saat ini) ---
const DISCORD_BOT_UPDATE_API_URL = process.env.DISCORD_BOT_UPDATE_API_URL;
const DISCORD_ORDER_NOTIFICATION_CHANNEL_ID = process.env.DISCORD_ORDER_NOTIFICATION_CHANNEL_ID;
const ADMIN_DISCORD_USER_ID = process.env.ADMIN_DISCORD_USER_ID;

// --- Email Configuration (Nodemailer) ---
const EMAIL_SERVICE = process.env.EMAIL_SERVICE;
const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT_SMTP = process.env.EMAIL_PORT_SMTP;
const EMAIL_SECURE = process.env.EMAIL_SECURE === 'true'; // Pastikan ini string 'true' atau 'false'
const EMAIL_USER = process.env.EMAIL_USER; // Email pengirim
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD; // Password email pengirim
const ADMIN_EMAIL_RECEIVER = process.env.ADMIN_EMAIL_RECEIVER; // Email admin untuk notifikasi order baru

// Konfigurasi transporter email
const transporter = nodemailer.createTransport({
    host: EMAIL_HOST || null,
    port: EMAIL_PORT_SMTP ? parseInt(EMAIL_PORT_SMTP, 10) : null,
    secure: EMAIL_SECURE,
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASSWORD,
    },
    connectionTimeout: 10 * 1000, // 10 detik
    socketTimeout: 30 * 1000 // 30 detik
});

// Test koneksi Nodemailer saat startup (untuk debugging awal)
transporter.verify(function(error, success) {
    if (error) {
        console.error('ERROR: Nodemailer transporter verification failed:', error);
        console.error('ERROR: Please check EMAIL_SERVICE, EMAIL_HOST, EMAIL_PORT_SMTP, EMAIL_SECURE, EMAIL_USER, EMAIL_PASSWORD in Dokploy Environment Variables.');
        process.exit(1); // Keluar dari proses jika koneksi email gagal saat startup
    } else {
        console.log('DEBUG: Nodemailer transporter is ready to send emails.');
    }
});

// --- DEFINISI HARGA LAYANAN (DIKELOLA DI BACKEND) ---
const FIXED_IMEI_PRICE = 250000; // Harga 1 IMEI = Rp 250.000
const SERVICE_PRICES = {
    "Temporary IMEI Activation (90 Days)": FIXED_IMEI_PRICE,
    "Permanent Unlock iPhone": FIXED_IMEI_PRICE,
    "Permanent Unlock Android": FIXED_IMEI_PRICE,
    "IMEI History Check": FIXED_IMEI_PRICE,
    "Other Service": FIXED_IMEI_PRICE,
};

// --- Database Configuration (MySQL) ---
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test koneksi database saat startup
pool.getConnection()
    .then(connection => {
        console.log('DEBUG: Successfully connected to MySQL database.');
        connection.release(); // Melepas koneksi setelah tes
    })
    .catch(err => {
        console.error('ERROR: Failed to connect to MySQL database:', err);
        console.error('ERROR: Please check your DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME in Dokploy Environment Variables.');
        process.exit(1); // Keluar dari proses jika koneksi database gagal
    });

// --- Middleware ---
const corsOptions = {
    origin: 'https://imeihub.id', // URL frontend yang diizinkan untuk mengakses backend ini. Pastikan menggunakan HTTPS.
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE', // Metode HTTP yang diizinkan
    credentials: true, // Mengizinkan pengiriman kredensial (seperti token JWT)
    optionsSuccessStatus: 204 // Status untuk preflight OPTIONS request
};
app.use(cors(corsOptions)); // Menerapkan middleware CORS
app.set('trust proxy', true); // Penting jika backend di belakang proxy/load balancer (Dokploy/Traefik)
app.use(bodyParser.json()); // Middleware untuk mem-parse JSON body request

// --- Fungsi Helper untuk Mengirim Email ---
async function sendEmail(to, subject, htmlContent) {
    const mailOptions = {
        from: EMAIL_USER, // Alamat pengirim email
        to: to, // Alamat penerima email
        subject: subject, // Subjek email
        html: htmlContent, // Konten email dalam format HTML
    };
    try {
        await transporter.sendMail(mailOptions);
        console.log(`Email sent to ${to} for subject: ${subject}`);
    } catch (error) {
        console.error(`ERROR: Failed to send email to ${to}:`, error);
    }
}

// --- Middleware Autentikasi JWT ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization']; // Mengambil header Authorization
    const token = authHeader && authHeader.split(' ')[1]; // Mengambil token (Bearer <token>)

    console.log('DEBUG_BACKEND: authenticateToken - Auth Header:', authHeader);
    console.log('DEBUG_BACKEND: authenticateToken - Extracted Token:', token);

    if (token == null) { // Jika token tidak ada
        return res.status(401).json({ message: 'Unauthorized: No token provided.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => { // Memverifikasi token JWT
        if (err) {
            console.error('JWT verification error:', err.message);
            return res.status(403).json({ message: 'Forbidden: Invalid or expired token.' });
        }
        req.user = user; // Menambahkan data user dari token ke request
        next(); // Lanjut ke middleware/route selanjutnya
    });
};

// --- Middleware Autentikasi Admin ---
const authenticateAdmin = (req, res, next) => {
    authenticateToken(req, res, () => {
        if (req.user && req.user.isAdmin) { // Cek apakah user memiliki flag isAdmin
            next(); // User adalah admin, lanjutkan
        } else {
            return res.status(403).json({ message: 'Forbidden: Admin access required.' }); // Bukan admin, tolak
        }
    });
};

// --- Fungsi untuk Mengirim Notifikasi ke Discord Bot (dihapus karena tidak digunakan) ---
// async function notifyDiscordBot(type, payload) { ... }


// --- API Endpoints ---

// POST /api/admin/create-user - Endpoint Admin untuk Membuat Akun User
app.post('/api/admin/create-user', authenticateAdmin, async (req, res) => {
    console.log('DEBUG: POST /api/admin/create-user received by ADMIN.');
    console.log('DEBUG: Request body:', req.body);

    const { username, fullname, email, phone, password } = req.body; // Tambah phone dari request body

    if (!username || !password) { // Hanya username dan password yang wajib
        console.warn('DEBUG: Missing required fields (username, password) for admin user creation.');
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    try {
        // Cek apakah username sudah ada di database
        const [existingUsers] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
        if (existingUsers.length > 0) {
            return res.status(409).json({ message: 'Username already taken.' }); // Pesan diubah
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUserId = uuidv4(); // Menghasilkan UUID baru
        
        // Masukkan user baru ke database, dengan username, fullname, email, phone dan is_admin
        const [result] = await pool.query(
            'INSERT INTO users(id, username, name, email, phone, password, is_admin) VALUES(?, ?, ?, ?, ?, ?, ?)', // Tambah phone ke INSERT
            [newUserId, username, fullname || null, email || null, phone || null, hashedPassword, false] // Tambah phone ke values
        );

        console.log('New user created by admin:', username);
        // Kirim email notifikasi ke admin tentang user baru
        const adminMailSubject = `New User Account Created: ${username}`;
        const adminMailHtml = `
            <p>A new user account has been created via the admin panel:</p>
            <ul>
                <li>Username: <b>${username}</b></li>
                <li>Full Name: ${fullname || 'N/A'}</li>
                <li>Email: ${email || 'N/A'}</li>
                <li>Phone: ${phone || 'N/A'}</li> </ul>
            <p>Please note: This user is not an admin by default.</p>
        `;
        console.log('DEBUG: Attempting to send email for new admin user notification.');
        await sendEmail(ADMIN_EMAIL_RECEIVER, adminMailSubject, adminMailHtml);
        console.log('DEBUG: Email sent for new admin user notification.');

        res.status(200).json({ message: `User "${username}" created successfully!`, userId: newUserId, userName: username }); // Status 200 OK
    } catch (error) {
        console.error('ERROR: Admin user creation error:', error);
        res.status(500).json({ message: 'Error creating user.', error: error.message });
        console.log('DEBUG: Admin user creation failed in catch block.');
    }
});


// POST /api/login - Login User (Publik)
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    try {
        const [users] = await pool.query('SELECT id, username, name, email, password, is_admin FROM users WHERE username = ?', [username]);
        const user = users[0];

        if (!user) { // Jika user tidak ditemukan
            return res.status(400).json({ message: 'Invalid username or password.' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) { // Jika password tidak cocok
            return res.status(400).json({ message: 'Invalid username or password.' });
        }

        const token = jwt.sign({ userId: user.id, isAdmin: user.is_admin }, JWT_SECRET); // Hapus expiresIn
        console.log('User logged in:', user.username);
        res.json({ message: 'Login successful', token, userId: user.id, userName: user.name || user.username, isAdmin: user.is_admin });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Error logging in.', error: error.message });
    }
});

// Middleware untuk memastikan user login untuk akses /order dan /orders/:userId
app.use('/api/order', authenticateToken); 
app.get('/api/orders/:userId', authenticateToken, async (req, res) => {
    if (req.user.userId !== req.params.userId) {
        return res.status(403).json({ message: 'Forbidden: You can only view your own orders.' });
    }

    try {
        const [userOrders] = await pool.query('SELECT order_id AS orderId, service_type AS serviceType, imei, status, order_date AS orderDate, amount FROM orders WHERE user_id = ? ORDER BY order_date DESC', [req.params.userId]);

        console.log(`Fetching orders for user ${req.params.userId}. Found ${userOrders.length} orders.`);
        res.json({ success: true, orders: userOrders });
    }
     catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ message: 'Error fetching orders.', error: error.message });
    }
});

// --- Admin Dashboard Endpoints (Dilindungi oleh authenticateAdmin) ---
app.get('/api/admin/stats', authenticateAdmin, async (req, res) => {
    try {
        const [totalOrdersResult] = await pool.query("SELECT COUNT(*) AS count FROM orders");
        const [pendingOrdersResult] = await pool.query("SELECT COUNT(*) AS count FROM orders WHERE status = 'Menunggu Pembayaran' OR status = 'Menunggu Proses Besok' OR status = 'Proses Aktif'"); // Hitung status baru
        const [completedOrdersResult] = await pool.query("SELECT COUNT(*) AS count FROM orders WHERE status = 'Selesai'");

        res.json({
            success: true,
            totalOrders: totalOrdersResult[0].count,
            pendingOrders: pendingOrdersResult[0].count,
            completedOrders: completedOrdersResult[0].count
        });
    } catch (error) {
        console.error('ERROR: Failed to fetch admin stats:', error);
        res.status(500).json({ message: 'Error fetching dashboard stats.', error: error.message });
    }
});

app.get('/api/admin/orders', authenticateAdmin, async (req, res) => {
    const sortBy = req.query.sortBy || 'order_date DESC';
    const searchName = req.query.searchName || '';

    console.log(`DEBUG_BACKEND: Fetching admin orders. SortBy: ${sortBy}, SearchName: ${searchName}`);

    const validSortColumns = ['order_date', 'order_id', 'customer_name', 'status', 'amount'];
    const [column, order] = sortBy.split(' ');
    if (!validSortColumns.includes(column) || !['ASC', 'DESC'].includes(order)) {
        console.warn(`DEBUG_BACKEND: Invalid sortBy parameter received: ${sortBy}. Using default.`);
        const defaultOrders = await pool.query(`
            SELECT 
                o.id, 
                o.order_id AS orderId, 
                o.user_id, 
                COALESCE(o.customer_name, u.username) AS customerName, 
                o.customer_email AS customerEmail, 
                o.customer_phone AS customerPhone, 
                o.imei, 
                o.service_type AS serviceType, 
                o.status, 
                o.order_date AS orderDate, 
                o.amount 
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
            ORDER BY order_date DESC
        `);
        return res.json({ success: true, orders: defaultOrders[0] });
    }

    try {
        let query = `
            SELECT 
                o.id, 
                o.order_id AS orderId, 
                o.user_id, 
                COALESCE(o.customer_name, u.username) AS customerName, 
                o.customer_email AS customerEmail, 
                o.customer_phone AS customerPhone, 
                o.imei, 
                o.service_type AS serviceType, 
                o.status, 
                o.order_date AS orderDate, 
                o.amount 
            FROM orders o
            LEFT JOIN users u ON o.user_id = u.id
        `;
        const queryParams = [];

        if (searchName) {
            query += ` WHERE COALESCE(o.customer_name, u.username) LIKE ?`;
            queryParams.push(`%${searchName}%`);
        }

        query += ` ORDER BY ${column} ${order}`;
        
        console.log('DEBUG_BACKEND: Executing admin orders query:', query, 'with params:', queryParams);
        const [orders] = await pool.query(query, queryParams);
        res.json({ success: true, orders: orders });
    } catch (error) {
        console.error('ERROR: Failed to fetch all orders for admin:', error);
        res.status(500).json({ message: 'Error fetching all orders.', error: error.message });
    }
});

app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
    try {
        const [users] = await pool.query("SELECT id, username, name, email, phone, is_admin FROM users ORDER BY created_at DESC"); // Tambah phone ke SELECT
        res.json({ success: true, users: users });
    } catch (error) {
        console.error('ERROR: Failed to fetch all users for admin:', error);
        res.status(500).json({ message: 'Error fetching all users.', error: error.message });
    }
});

app.post('/api/admin/update-order-status', authenticateAdmin, async (req, res) => {
    const { orderId, newStatus, initiator } = req.body;

    if (!orderId || !newStatus) {
        return res.status(400).json({ message: 'Order ID and new status are required.' });
    }

    const validStatuses = ['Menunggu Pembayaran', 'Diproses', 'Selesai', 'Dibatalkan', 'Menunggu Proses Besok', 'Proses Aktif'];
    if (!validStatuses.includes(newStatus)) {
        return res.status(400).json({ message: 'Invalid status provided.' });
    }

    try {
        const [orderRows] = await pool.query('SELECT o.customer_email, o.customer_name, u.username, o.service_type FROM orders o JOIN users u ON o.user_id = u.id WHERE o.order_id = ?', [orderId]);
        const order = orderRows[0];

        if (!order) {
            console.warn(`DEBUG: Order ${orderId} not found for status update.`);
            return res.status(404).json({ success: false, message: `Order ${orderId} not found.` });
        }

        const [result] = await pool.query('UPDATE orders SET status = ? WHERE order_id = ?', [newStatus, orderId]);
        
        if (result.affectedRows > 0) {
            console.log(`Order ${orderId} updated to status: ${newStatus} by Admin.`);
            
            if (order.customer_email) {
                const mailSubject = `Order Status Update: ${orderId} - ${newStatus}`;
                const mailHtml = `
                    <p>Dear ${order.customerName || order.username},</p>
                    <p>Your order status for Order ID <b>${orderId}</b> has been updated to <b>${newStatus}</b>.</p>
                    <p>Service: ${order.service_type}</p>
                    <p>You can check the full details on your dashboard: <a href="https://imeihub.id/my-orders.html">My Orders</a></p>
                    <p>Thank you for your patience.</p>
                `;
                await sendEmail(order.customer_email, mailSubject, mailHtml);
            } else {
                console.warn(`DEBUG: No email sent for order ${orderId}, customer email missing or notification HTML not generated.`);
            }

            res.json({ success: true, message: `Status for order ${orderId} updated to ${newStatus}.` });
        } else {
            console.warn(`DEBUG: Order ${orderId} not found for status update (no rows affected).`);
            res.status(404).json({ success: false, message: `Order ${orderId} not found.` });
        }
    } catch (error) {
        console.error('ERROR: Error updating order status from admin dashboard:', error);
        res.status(500).json({ success: false, message: 'Error updating order status.', error: error.message });
    }
});


// POST /api/order/submit - Endpoint untuk Submit Order (Tanpa Payment Gateway)
app.post('/api/order/submit', authenticateToken, async (req, res) => {
    console.log('DEBUG: Order submission request received.');
    const userId = req.user.userId;
    const { imeis, serviceType } = req.body; // customerPhone DIHAPUS dari req.body, akan diambil dari DB

    // Ambil detail user yang login dari database, termasuk phone
    const [userRows] = await pool.query('SELECT username, name, email, phone FROM users WHERE id = ?', [userId]); // Tambah phone ke SELECT
    const loggedInUser = userRows[0];
    if (!loggedInUser) {
        console.error('ERROR: Logged in user not found in DB for order submission:', userId);
        return res.status(400).json({ success: false, message: 'Logged in user data not found.' });
    }

    const customerName = loggedInUser.name || loggedInUser.username;
    const customerEmail = loggedInUser.email;
    const customerPhone = loggedInUser.phone; // <<-- Ambil phone dari DB user

    // Validasi utama: pastikan semua field esensial ada, termasuk phone dari DB
    if (!Array.isArray(imeis) || imeis.length === 0 || !serviceType || !customerPhone) { // customerPhone sekarang divalidasi dari DB
        console.warn('DEBUG: Order submission validation failed. IMEIs, service type, or phone number from DB are missing.');
        let message = '';
        if (!Array.isArray(imeis) || imeis.length === 0) message += 'IMEI(s) are required. ';
        if (!serviceType) message += 'Service type is required. ';
        if (!customerPhone) message += 'Phone number not found in your user profile. Please update your profile.'; // Pesan spesifik
        return res.status(400).json({ success: false, message: message });
    }

    const amountPerImei = SERVICE_PRICES[serviceType];
    if (!amountPerImei) {
        console.warn(`DEBUG: Invalid or undefined amount for service type: ${serviceType}`);
        return res.status(400).json({ success: false, message: `Price not defined for service: ${serviceType}` });
    }

    const ordersCreated = [];
    const adminNotificationImeis = []; // Untuk ringkasan IMEI di email admin

    // --- LOGIKA JAM BISNIS UNTUK STATUS AWAL ORDER ---
    const now = new Date();
    const currentHour = now.getHours(); // Jam lokal server (UTC di container)
    const businessStartHour = 7; // 7 AM
    const businessEndHour = 17; // 5 PM (17:00)

    let initialStatus = 'Menunggu Pembayaran'; // Default status
    if (currentHour >= businessStartHour && currentHour < businessEndHour) { // Dalam jam kerja
        initialStatus = 'Proses Aktif'; // Status baru
    } else {
        initialStatus = 'Menunggu Proses Besok'; // Di luar jam kerja
    }
    console.log(`DEBUG: Order placed at hour ${currentHour}. Initial status set to: ${initialStatus}`);


    try {
        for (const imei of imeis) {
            const orderId = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`; // Order ID unik per IMEI
            const newOrderId = uuidv4(); // UUID untuk ID primer tabel orders

            await pool.query(
                'INSERT INTO orders(id, order_id, user_id, customer_name, customer_email, customer_phone, imei, service_type, status, order_date, amount) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)',
                [newOrderId, orderId, userId, customerName, customerEmail, customerPhone, imei, serviceType, initialStatus, amountPerImei]
            );
            console.log(`Order ${orderId} for IMEI ${imei} saved to database.`);
            ordersCreated.push({ orderId, imei, amount: amountPerImei, initialStatus });
            adminNotificationImeis.push(imei);
        }

        // --- Kirim Notifikasi Order Baru ke Email Admin (Ringkasan) ---
        const adminMailSubject = `New Order(s) Received from ${customerName}`;
        const adminMailHtml = `
            <p>New order(s) received from <b>${customerName}</b> (${customerEmail}):</p>
            <ul>
                <li>Total IMEIs: <b>${imeis.length}</b></li>
                <li>Service Type: <b>${serviceType}</b></li>
                <li>Customer Phone: <b>${customerPhone}</b></li>
                <li>Initial Status: <b>${initialStatus}</b></li>
                <li>IMEIs: ${adminNotificationImeis.join(', ')}</li>
            </ul>
            <p>Check admin dashboard for more details: <a href="https://imeihub.id/admin_dashboard.html">Admin Dashboard</a></p>
        `;
        console.log('DEBUG: Attempting to send email for new order notification to primary admin.');
        await sendEmail(ADMIN_EMAIL_RECEIVER, adminMailSubject, adminMailHtml); // Kirim ke admin utama
        console.log('DEBUG: Email sent for new order notification to primary admin.');

        // --- Kirim Notifikasi Order Baru ke SEMUA Admin Lainnya (dari database) ---
        const [allAdmins] = await pool.query("SELECT email FROM users WHERE is_admin = TRUE AND email IS NOT NULL AND email != ?", [ADMIN_EMAIL_RECEIVER]);
        for (const admin of allAdmins) {
            if (admin.email) {
                console.log(`DEBUG: Sending new order notification to additional admin: ${admin.email}`);
                await sendEmail(admin.email, adminMailSubject, adminMailHtml);
            }
        }
        console.log('DEBUG: Email sent for new order notification to all additional admins.');

        // --- Kirim Notifikasi Konfirmasi Order ke Email User (Ringkasan) ---
        if (customerEmail) {
            const userMailSubject = `Order Confirmation: ${ordersCreated.map(o => o.orderId).join(', ')}`;
            const userMailHtml = `
                <p>Dear ${customerName},</p>
                <p>Thank you for your order(s)!</p>
                <p>You have submitted <b>${imeis.length}</b> IMEI(s) for <b>${serviceType}</b> service.</p>
                <ul>
                    ${ordersCreated.map(order => `<li>Order ID: <b>${order.orderId}</b>, IMEI: <b>${order.imei}</b>, Amount: Rp ${order.amount.toLocaleString('id-ID')}, Status: ${order.initialStatus}</li>`).join('')}
                </ul>
                <p>You can track your order status here: <a href="https://imeihub.id/my-orders.html">My Orders</a></p>
                <p>We will process your order(s) soon.</p>
            `;
            console.log('DEBUG: Attempting to send email order confirmation to user.');
            await sendEmail(customerEmail, userMailSubject, userMailHtml);
            console.log('DEBUG: Email sent for new order confirmation to user.');
        } else {
            console.warn(`DEBUG: User email not available for order submission, skipping user email confirmation.`);
        }

        res.status(200).json({
            success: true,
            message: `${imeis.length} order(s) submitted successfully.`,
            orders: ordersCreated // Mengembalikan array order yang dibuat
        });

    } catch (error) {
        console.error('ERROR: Order submission request failed:', error);
        res.status(500).json({ success: false, message: 'Internal server error during order submission.', error: error.message });
    }
});

// POST /api/orders/cancel - Endpoint untuk Membatalkan Order oleh User
app.post('/api/orders/cancel', authenticateToken, async (req, res) => {
    const userId = req.user.userId;
    const { orderId } = req.body;

    if (!orderId) {
        return res.status(400).json({ message: 'Order ID is required.' });
    }

    try {
        const [orderRows] = await pool.query('SELECT status, user_id, customer_email, customer_name, service_type FROM orders WHERE order_id = ?', [orderId]);
        const order = orderRows[0];

        if (!order) {
            console.warn(`DEBUG_BACKEND: Order ${orderId} not found for cancellation.`);
            return res.status(404).json({ success: false, message: `Order ${orderId} not found.` });
        }

        if (order.user_id !== userId) {
            console.warn(`DEBUG_BACKEND: User ${userId} tried to cancel order ${orderId} which belongs to ${order.user_id}.`);
            return res.status(403).json({ success: false, message: 'Forbidden: You can only cancel your own orders.' });
        }

        if (order.status === 'Diproses' || order.status === 'Selesai' || order.status === 'Dibatalkan') {
            console.warn(`DEBUG_BACKEND: Order ${orderId} cannot be cancelled due to current status: ${order.status}.`);
            return res.status(400).json({ success: false, message: `Order cannot be cancelled. Current status: ${order.status}.` });
        }

        const newStatus = 'Dibatalkan';
        const [result] = await pool.query('UPDATE orders SET status = ? WHERE order_id = ?', [newStatus, orderId]);

        if (result.affectedRows > 0) {
            console.log(`DEBUG_BACKEND: Order ${orderId} cancelled by user ${userId}.`);
            // Notifikasi ke user yang membatalkan
            if (order.customer_email) {
                const userMailSubject = `Order Cancellation Confirmation: ${orderId}`;
                const userMailHtml = `
                    <p>Dear ${order.customerName || 'user'},</p>
                    <p>Your order <b>${orderId}</b> has been successfully cancelled.</p>
                    <p>You can view your orders here: <a href="https://imeihub.id/my-orders.html">My Orders</a></p>
                `;
                await sendEmail(order.customer_email, userMailSubject, userMailHtml);
            }

            // Notifikasi ke semua admin tentang pembatalan order oleh user
            const adminMailSubject = `Order Cancelled by User: ${orderId}`;
            const adminMailHtml = `
                <p>Order <b>${orderId}</b> (Service: ${order.service_type}) has been cancelled by user ${order.customerName || order.username} (ID: ${userId}).</p>
                <p>Current status: Dibatalkan.</p>
                <p>Check admin dashboard: <a href="https://imeihub.id/admin_dashboard.html">Admin Dashboard</a></p>
            `;
            const [allAdmins] = await pool.query("SELECT email FROM users WHERE is_admin = TRUE AND email IS NOT NULL");
            for (const admin of allAdmins) {
                if (admin.email) {
                    await sendEmail(admin.email, adminMailSubject, adminMailHtml);
                }
            }

            res.json({ success: true, message: `Order ${orderId} cancelled successfully.` });
        } else {
            console.warn(`DEBUG_BACKEND: Order ${orderId} not found for cancellation (no rows affected).`);
            res.status(404).json({ success: false, message: `Order ${orderId} not found.` });
        }
    } catch (error) {
        console.error('ERROR: Error cancelling order:', error);
        res.status(500).json({ success: false, message: 'Internal server error during order cancellation.', error: error.message });
    }
});

//update role

app.post('/api/admin/users/update-role', authenticateToken, async (req, res) => {
    const { userId, isAdmin } = req.body;

    if (!userId || typeof isAdmin === 'undefined') {
        return res.status(400).json({ success: false, message: 'User ID dan isAdmin wajib disediakan.' });
    }

    try {
        const [result] = await pool.query(
            'UPDATE users SET is_admin = ? WHERE id = ?',
            [isAdmin ? 1 : 0, userId]
        );

        if (result.affectedRows > 0) {
            console.log(`✅ Peran user ${userId} diubah ke ${isAdmin ? 'Admin' : 'User'}`);
            res.json({ success: true, message: 'Peran user berhasil diupdate.' });
        } else {
            res.status(404).json({ success: false, message: 'User tidak ditemukan.' });
        }
    } catch (error) {
        console.error('❌ Gagal update role:', error);
        res.status(500).json({ success: false, message: 'Terjadi kesalahan saat update role.', error: error.message });
    }
});

//


// --- Endpoint untuk Discord Bot memanggil backend untuk update status (tidak digunakan) ---
app.post('/api/discord-webhook-commands', async (req, res) => {
    const { type, payload } = req.body;

    console.log('Received command from Discord Bot:', JSON.stringify(payload, null, 2));

    if (type === 'update_order_status' && payload && payload.orderId && payload.newStatus && payload.initiatorId) {
        const { orderId, newStatus, initiatorId } = payload;

        console.log(`Received status update for Order ${orderId} to ${newStatus} from initiator ${initiatorId}.`);

        try {
            const [result] = await pool.query('UPDATE orders SET status = ? WHERE order_id = ?', [newStatus, orderId]);
            
            if (result.affectedRows > 0) {
                console.log(`Order ${orderId} updated to status: ${newStatus}.`);
                res.json({ success: true, message: `Status for order ${orderId} updated to ${newStatus}.` });
            } else {
                console.warn(`Order ${orderId} not found for status update.`);
                res.status(404).json({ success: false, message: `Order ${orderId} not found.` });
            }
        } catch (error) {
            console.error('Error updating order status:', error);
            res.status(500).json({ success: false, message: 'Error updating order status.', error: error.message });
        }
    } else {
        console.warn(`Unknown command type or invalid payload from Discord Bot.`);
        res.status(400).json({ success: false, message: 'Invalid command type or payload.' });
    }
});


// --- Start Server ---
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Backend server running on http://0.0.0.0:${PORT}`);
});
