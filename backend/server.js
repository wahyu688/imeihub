require('dotenv').config(); // Memuat variabel lingkungan dari file .env
const express = require('express');
const bodyParser = require('body-parser'); // Middleware untuk mem-parse body request
const cors = require('cors'); // Middleware untuk Cross-Origin Resource Sharing
const jwt = require('jsonwebtoken'); // Library untuk JSON Web Tokens
const bcrypt = require('bcryptjs'); // Library untuk hashing password
const { v4: uuidv4 } = require('uuid'); // Library untuk menghasilkan UUID
const fetch = require('node-fetch'); // Untuk melakukan HTTP requests
const crypto = require('crypto'); // Modul bawaan Node.js untuk kriptografi (HMAC SHA256)
const nodemailer = require('nodemailer'); // Library untuk mengirim email

const app = express();
const PORT = process.env.PORT || 3000; // Port server dari variabel lingkungan atau default 3000
const JWT_SECRET = process.env.JWT_SECRET; // Secret key untuk JWT dari variabel lingkungan
const ADMIN_API_KEY_BACKEND = process.env.ADMIN_API_KEY_BACKEND; // API Key untuk endpoint admin

// --- Discord Configurations (untuk notifikasi internal, bukan lagi utama) ---
const DISCORD_BOT_UPDATE_API_URL = process.env.DISCORD_BOT_UPDATE_API_URL;
const DISCORD_ORDER_NOTIFICATION_CHANNEL_ID = process.env.DISCORD_ORDER_NOTIFICATION_CHANNEL_ID;
const ADMIN_DISCORD_USER_ID = process.env.ADMIN_DISCORD_USER_ID; // Tidak lagi digunakan untuk verifikasi utama

// --- Tripay API Credentials ---
const TRIPAY_API_KEY = process.env.TRIPAY_API_KEY; // API Key dari Tripay
const TRIPAY_PRIVATE_KEY = process.env.TRIPAY_PRIVATE_KEY; // Private Key dari Tripay
const TRIPAY_MERCHANT_CODE = process.env.TRIPAY_MERCHANT_CODE; // Merchant Code dari Tripay
const TRIPAY_BASE_URL = process.env.TRIPAY_BASE_URL; // Base URL Tripay (sandbox atau production)
const TRIPAY_MODE = process.env.TRIPAY_MODE; // Mode Tripay (sandbox/production)

// --- Email Configuration (Nodemailer) ---
const EMAIL_SERVICE = process.env.EMAIL_SERVICE; // Layanan email (misal 'gmail')
const EMAIL_USER = process.env.EMAIL_USER; // Email pengirim
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD; // Password email pengirim
const ADMIN_EMAIL_RECEIVER = process.env.ADMIN_EMAIL_RECEIVER; // Email admin untuk notifikasi internal

// Konfigurasi transporter email
const transporter = nodemailer.createTransport({
    service: EMAIL_SERVICE,
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASSWORD,
    },
});

// Test koneksi Nodemailer saat startup (untuk debugging)
transporter.verify(function(error, success) {
    if (error) {
        console.error('ERROR: Nodemailer transporter verification failed:', error);
        console.error('ERROR: Please check EMAIL_SERVICE, EMAIL_USER, EMAIL_PASSWORD in Dokploy Environment Variables.');
        // Jika Anda ingin aplikasi crash jika email tidak bisa terhubung: process.exit(1);
    } else {
        console.log('DEBUG: Nodemailer transporter is ready to send emails.');
    }
});

// --- DEFINISI HARGA LAYANAN (DIKELOLA DI BACKEND) ---
const SERVICE_PRICES = {
    "Temporary IMEI Activation (90 Days)": 100000, // Harga dalam IDR (misal: Rp 100.000)
    "Permanent Unlock iPhone": 500000,
    "Permanent Unlock Android": 300000,
    "IMEI History Check": 50000,
    "Other Service": 75000,
};

// --- Database Configuration (MySQL) ---
const mysql = require('mysql2/promise'); // Import driver mysql2/promise

const pool = mysql.createPool({ // Membuat koneksi pool MySQL
    host: process.env.DB_HOST, // Host database dari variabel lingkungan
    user: process.env.DB_USER, // User database dari variabel lingkungan
    database: process.env.DB_NAME, // Nama database dari variabel lingkungan
    password: process.env.DB_PASSWORD, // Password database dari variabel lingkungan
    port: process.env.DB_PORT, // Port database dari variabel lingkungan
    waitForConnections: true, // Menunggu koneksi jika pool habis
    connectionLimit: 10, // Batas koneksi di pool
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
    // URL frontend yang diizinkan untuk mengakses backend ini. Pastikan menggunakan HTTPS.
    origin: 'https://imeihub.id', 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE', // Metode HTTP yang diizinkan
    credentials: true, // Mengizinkan pengiriman kredensial (seperti token JWT)
    optionsSuccessStatus: 204 // Status untuk preflight OPTIONS request
};
app.use(cors(corsOptions)); // Menerapkan middleware CORS
app.set('trust proxy', true); // Penting jika backend di belakang proxy/load balancer (Dokploy/Traefik)
app.use(bodyParser.json()); // Middleware untuk mem-parse JSON body request


// --- Fungsi Helper untuk Generate Tripay Signature ---
function generateTripaySignature(reference, amount, privateKey) {
    const data = `${TRIPAY_MERCHANT_CODE}${reference}${amount}`;
    const hmac = crypto.createHmac('sha256', privateKey); // Membuat HMAC SHA256
    hmac.update(data); // Mengupdate dengan data
    return hmac.digest('hex'); // Mengembalikan hasil dalam format hex
}

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
    authenticateToken(req, res, () => { // Pertama, otentikasi user dengan JWT
        if (req.user && req.user.isAdmin) { // Kemudian cek apakah user memiliki flag isAdmin
            next(); // User adalah admin, lanjutkan
        } else {
            return res.status(403).json({ message: 'Forbidden: Admin access required.' }); // Bukan admin, tolak
        }
    });
};

// --- Fungsi untuk Mengirim Notifikasi ke Discord Bot (Tidak lagi digunakan untuk notifikasi utama, tapi tetap ada di code) ---
async function notifyDiscordBot(type, payload) {
    // Implementasi ini tidak akan dipanggil jika kita beralih ke email untuk notifikasi utama
    console.warn("Discord Bot notification function called, but Discord integration is replaced by email for primary notifications.");
    return { success: true, message: "Discord notification skipped." };
    /*
    // Jika Anda ingin mengaktifkan kembali Discord:
    if (!DISCORD_BOT_UPDATE_API_URL) {
        console.warn("Discord Bot Update API URL not configured. Notification not sent.");
        return { success: false, message: "Discord Bot API not configured." };
    }

    try {
        const response = await fetch(DISCORD_BOT_UPDATE_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', },
            body: JSON.stringify({ type, payload })
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`Failed to notify Discord Bot for ${type}:`, response.status, errorText);
            return { success: false, message: `Failed to notify Discord Bot for ${type}: ${response.status} - ${errorText}` };
        }
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            const data = await response.json();
            console.log(`Discord Bot notified for ${type}:`, data);
            return { success: true, data: data };
        } else {
            console.log(`Discord Bot notified for ${type}: (No JSON response body)`);
            return { success: true, message: "Notification sent, no JSON response from bot." };
        }
    } catch (error) {
        console.error(`Error notifying Discord Bot for ${type}:`, error);
        return { success: false, message: error.message || "Internal server error during Discord Bot notification." };
    }
    */
}


// --- API Endpoints ---

// POST /api/admin/create-user - Endpoint Admin untuk Membuat Akun User
// Endpoint ini dilindungi oleh authenticateAdmin
app.post('/api/admin/create-user', authenticateAdmin, async (req, res) => {
    // ADMIN_API_KEY_BACKEND tidak lagi diperlukan di sini karena sudah dilindungi oleh JWT admin
    console.log('DEBUG: POST /api/admin/create-user received by ADMIN.');
    console.log('DEBUG: Request body:', req.body);

    const { username, fullname, email, password } = req.body;

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
        
        // Masukkan user baru ke database, dengan username, fullname, dan email opsional
        const [result] = await pool.query(
            'INSERT INTO users(id, username, name, email, password, is_admin) VALUES(?, ?, ?, ?, ?, ?)', 
            [newUserId, username, fullname || null, email || null, hashedPassword, false] // is_admin default FALSE
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
            </ul>
            <p>Please note: This user is not an admin by default.</p>
        `;
        console.log('DEBUG: Attempting to send email for new admin user notification.');
        await sendEmail(ADMIN_EMAIL_RECEIVER, adminMailSubject, adminMailHtml);
        console.log('DEBUG: Email sent for new admin user notification.');

        res.status(201).json({ message: `User "${username}" created successfully!`, userId: newUserId, userName: username });
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
        // Cari user di database berdasarkan username
        const [users] = await pool.query('SELECT id, username, name, email, password, is_admin FROM users WHERE username = ?', [username]);
        const user = users[0];

        if (!user) { // Jika user tidak ditemukan
            return res.status(400).json({ message: 'Invalid username or password.' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) { // Jika password tidak cocok
            return res.status(400).json({ message: 'Invalid username or password.' });
        }

        const token = jwt.sign({ userId: user.id, isAdmin: user.is_admin }, JWT_SECRET, { expiresIn: '1h' }); // Sertakan isAdmin di JWT
        console.log('User logged in:', user.username);
        res.json({ message: 'Login successful', token, userId: user.id, userName: user.name || user.username, isAdmin: user.is_admin }); // Kembalikan isAdmin
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
        // Mengambil orders dari database untuk user tertentu
        const [userOrders] = await pool.query('SELECT order_id AS orderId, service_type AS serviceType, imei, status, payment_method AS paymentMethod, order_date AS orderDate, amount FROM orders WHERE user_id = ? ORDER BY order_date DESC', [req.params.userId]);
        
        console.log(`Fetching orders for user ${req.params.userId}. Found ${userOrders.length} orders.`);
        res.json({ success: true, orders: userOrders }); // Tambah success:true
    }
     catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ message: 'Error fetching orders.', error: error.message });
    }
});

// POST /api/payment/initiate - Endpoint untuk Inisiasi Pembayaran (Tripay)
app.post('/api/payment/initiate', authenticateToken, async (req, res) => {
    console.log('DEBUG: Payment initiate request received.');
    const userId = req.user.userId;
    const { name, email, phone, imei, serviceType, paymentMethod } = req.body;

    const amount = SERVICE_PRICES[serviceType];
    if (!amount) {
        console.warn(`DEBUG: Invalid or undefined amount for service type: ${serviceType}`);
        return res.status(400).json({ success: false, message: `Price not defined for service: ${serviceType}` });
    }
    const amountInCents = Math.round(amount);

    if (!name || !email || !phone || !imei || !serviceType || !paymentMethod) {
        return res.status(400).json({ message: 'All order fields are required for payment initiation.' });
    }

    const orderId = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 100)}`;
    const merchantRef = `${orderId}-${Date.now()}`;
    const newOrderId = uuidv4();

    try {
        await pool.query(
            'INSERT INTO orders(id, order_id, user_id, customer_name, customer_email, customer_phone, imei, service_type, payment_method, status, order_date, amount) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)',
            [newOrderId, orderId, userId, name, email, phone, imei, serviceType, paymentMethod, 'Menunggu Pembayaran', amountInCents]
        );
        console.log(`Order ${orderId} saved to database.`);

        // --- Panggil Tripay API untuk Inisiasi Pembayaran ---
        const tripayRequest = {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${TRIPAY_API_KEY}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json',
            },
            body: JSON.stringify({
                method: paymentMethod,
                merchant_ref: merchantRef,
                amount: amountInCents,
                customer_name: name,
                customer_email: email,
                customer_phone: phone,
                order_items: [{
                    sku: serviceType.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().substring(0, 15),
                    name: serviceType,
                    price: amountInCents,
                    quantity: 1
                }],
                callback_url: `https://back.imeihub.id/api/payment-callback`, // URL callback untuk notifikasi Tripay
                return_url: `https://imeihub.id/my-orders.html`, // URL redirect setelah pembayaran
                expired_time: (Date.now() / 1000) + (24 * 60 * 60) // 24 jam dari sekarang
            })
        };

        const tripayResponse = await fetch(`${TRIPAY_BASE_URL}/transaction/create`, tripayRequest);
        const tripayData = await tripayResponse.json();

        if (tripayResponse.ok && tripayData.success) {
            console.log('DEBUG: Tripay transaction created successfully:', tripayData.data);
            
            // --- Kirim Notifikasi Pesanan Baru ke Email Admin ---
            const adminMailSubject = `New Order Received: ${orderId} (${serviceType})`;
            const adminMailHtml = `
                <p>New order received from ${name} (${email}):</p>
                <ul>
                    <li>Order ID: <b>${orderId}</b></li>
                    <li>Service: ${serviceType}</li>
                    <li>IMEI: ${imei}</li>
                    <li>Amount: Rp ${amountInCents.toLocaleString('id-ID')}</li>
                    <li>Payment Method: ${paymentMethod}</li>
                    <li>Status: Menunggu Pembayaran</li>
                    <li>Customer Phone: ${phone}</li>
                </ul>
                <p>Check admin dashboard for more details: <a href="https://imeihub.id/admin_dashboard.html">Admin Dashboard</a></p>
            `;
            console.log('DEBUG: Attempting to send email for new order notification.');
            await sendEmail(ADMIN_EMAIL_RECEIVER, adminMailSubject, adminMailHtml);
            console.log('DEBUG: Email sent for new order notification.');

            res.status(200).json({
                success: true,
                message: 'Payment initiated successfully.',
                orderId: orderId, // Sertakan orderId untuk frontend
                reference: tripayData.data.reference,
                amount: tripayData.data.amount,
                checkout_url: tripayData.data.checkout_url,
                qr_string: tripayData.data.qr_string || null,
                va_number: tripayData.data.pay_code || null,
                va_bank: tripayData.data.pay_code ? tripayData.data.payment_method_code : null,
                instructions: tripayData.data.instructions ? tripayData.data.instructions[0]?.steps.join('\n') : null
            });

        } else {
            console.error('ERROR: Tripay API error during transaction creation:', tripayData.message || tripayResponse.statusText);
            res.status(500).json({ success: false, message: tripayData.message || 'Failed to create Tripay transaction.' });
        }
    } catch (error) {
        console.error('ERROR: Payment initiation request failed:', error);
        res.status(500).json({ success: false, message: 'Internal server error during payment initiation.' });
    }
});

// POST /api/payment-callback - Endpoint untuk Menerima Notifikasi Pembayaran (Tripay Webhook)
app.post('/api/payment-callback', async (req, res) => {
    console.log('DEBUG: Tripay callback received!');
    console.log('DEBUG: Tripay callback headers:', req.headers);
    console.log('DEBUG: Tripay callback raw body:', JSON.stringify(req.body, null, 2));

    const jsonBody = req.body;

    const tripaySignature = req.headers['x-callback-signature'];
    const tripayEvent = req.headers['x-callback-event'];
    
    const calculatedSignature = crypto.createHmac('sha256', TRIPAY_PRIVATE_KEY)
                                      .update(JSON.stringify(jsonBody)) 
                                      .digest('hex');

    if (calculatedSignature !== tripaySignature) {
        console.warn('DEBUG: Invalid Tripay callback signature!');
        return res.status(400).json({ success: false, message: 'Invalid signature.' });
    }

    if (tripayEvent !== 'transaction_updated') {
        console.warn(`DEBUG: Unhandled Tripay event: ${tripayEvent}`);
        return res.status(200).json({ success: true, message: 'Event ignored.' });
    }

    const { reference, status, amount } = jsonBody.data;

    console.log(`DEBUG: Tripay callback valid for reference ${reference}, status ${status}, amount ${amount}`);

    try {
        const [orders] = await pool.query('SELECT customer_email, customer_name, username, service_type, status FROM orders WHERE order_id = ?', [reference]);
        const order = orders[0];

        if (!order) {
            console.warn(`DEBUG: Order with ID ${reference} not found in database for callback.`);
            return res.status(404).json({ success: false, message: 'Order not found.' });
        }

        let newStatus = order.status; 
        let notificationSubject = `Order Update: ${reference} - ${status}`;
        let notificationHtml = '';

        if (status === 'PAID' || status === 'SETTLEMENT') {
            newStatus = 'Diproses';
            notificationSubject = `Pembayaran Berhasil untuk Order ID: ${reference}`;
            notificationHtml = `
                <p>Halo ${order.customerName || order.username},</p>
                <p>Pembayaran Anda untuk Order ID <b>${reference}</b> sebesar Rp ${amount.toLocaleString('id-ID')} telah berhasil!</p>
                <p>Status pesanan Anda telah diperbarui menjadi: <b>${newStatus}</b>.</p>
                <p>Layanan: ${order.service_type}</p>
                <p>Kami akan segera memproses pesanan Anda.</p>
                <p>Cek status terbaru Anda di <a href="https://imeihub.id/my-orders.html">Dashboard Pesanan Saya</a>.</p>
                <p>Terima kasih atas pembayaran Anda.</p>
            `;
        } else if (status === 'EXPIRED' || status === 'FAILED' || status === 'REFUND') {
            newStatus = 'Dibatalkan';
            notificationSubject = `Pembayaran Gagal/Kadaluarsa untuk Order ID: ${reference}`;
            notificationHtml = `
                <p>Halo ${order.customerName || order.username},</p>
                <p>Pembayaran Anda untuk Order ID <b>${reference}</b> telah gagal atau kedaluwarsa.</p>
                <p>Status pesanan Anda telah diperbarui menjadi: <b>${newStatus}</b>.</p>
                <p>Jika Anda ingin melanjutkan, mohon buat pesanan baru.</p>
                <p>Cek status terbaru Anda di <a href="https://imeihub.id/my-orders.html">Dashboard Pesanan Saya</a>.</p>
            `;
        } else if (status === 'PENDING') {
            newStatus = 'Menunggu Pembayaran'; 
        } else {
            console.warn(`DEBUG: Unhandled Tripay transaction status: ${status} for order ${reference}. No status update.`);
            return res.status(200).json({ success: true, message: 'Status handled.' }); 
        }

        if (newStatus !== order.status) {
            await pool.query('UPDATE orders SET status = ?, payment_method = ?, amount = ? WHERE order_id = ?', [newStatus, order.payment_method, amount, reference]);
            console.log(`DEBUG: Order ${reference} status updated to ${newStatus} via Tripay callback.`);

            if (order.customer_email && notificationHtml) {
                await sendEmail(order.customer_email, notificationSubject, notificationHtml);
            } else {
                console.warn(`DEBUG: No email sent for order ${reference}, customer email missing or notification HTML not generated.`);
            }
        }

        res.status(200).json({ success: true, message: 'Callback received and processed.' });

    } catch (error) {
        console.error('ERROR: Tripay callback processing error:', error);
        res.status(500).json({ success: false, message: 'Internal server error during callback processing.', error: error.message });
    }
});


// --- Endpoint untuk Discord Bot memanggil backend untuk update status ---
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
