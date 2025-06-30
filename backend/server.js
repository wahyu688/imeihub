require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');
const crypto = require('crypto');
const nodemailer = require('nodemailer'); // Import Nodemailer

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_API_KEY_BACKEND = process.env.ADMIN_API_KEY_BACKEND;

// --- Discord Configurations (Tidak lagi digunakan untuk notifikasi utama, tapi tetap di code) ---
const DISCORD_BOT_UPDATE_API_URL = process.env.DISCORD_BOT_UPDATE_API_URL;
const DISCORD_ORDER_NOTIFICATION_CHANNEL_ID = process.env.DISCORD_ORDER_NOTIFICATION_CHANNEL_ID;
const ADMIN_DISCORD_USER_ID = process.env.ADMIN_DISCORD_USER_ID;

// --- Tripay API Credentials ---
const TRIPAY_API_KEY = process.env.TRIPAY_API_KEY;
const TRIPAY_PRIVATE_KEY = process.env.TRIPAY_PRIVATE_KEY;
const TRIPAY_MERCHANT_CODE = process.env.TRIPAY_MERCHANT_CODE;
const TRIPAY_BASE_URL = process.env.TRIPAY_BASE_URL; 
const TRIPAY_MODE = process.env.TRIPAY_MODE;

// --- Email Configuration (Nodemailer) ---
const EMAIL_SERVICE = process.env.EMAIL_SERVICE; // e.g., 'gmail', 'SendGrid'
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;
const ADMIN_EMAIL_RECEIVER = process.env.ADMIN_EMAIL_RECEIVER; // Email admin untuk notifikasi internal

const transporter = nodemailer.createTransport({
    service: EMAIL_SERVICE,
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASSWORD,
    },
});

// --- DEFINISI HARGA LAYANAN (DIKELOLA DI BACKEND) ---
const SERVICE_PRICES = {
    "Temporary IMEI Activation (90 Days)": 100000, // Harga dalam IDR
    "Permanent Unlock iPhone": 500000,
    "Permanent Unlock Android": 300000,
    "IMEI History Check": 50000,
    "Other Service": 75000,
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

pool.getConnection()
    .then(connection => {
        console.log('DEBUG: Successfully connected to MySQL database.');
        connection.release();
    })
    .catch(err => {
        console.error('ERROR: Failed to connect to MySQL database:', err);
        console.error('ERROR: Please check your DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME in Dokploy Environment Variables.');
        process.exit(1);
    });

// --- Middleware ---
const corsOptions = {
    origin: 'https://imeihub.id', 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    optionsSuccessStatus: 204
};
app.use(cors(corsOptions));
app.set('trust proxy', true); 
app.use(bodyParser.json());

// --- Fungsi Helper untuk Generate Tripay Signature ---
function generateTripaySignature(reference, amount, privateKey) {
    const data = `${TRIPAY_MERCHANT_CODE}${reference}${amount}`;
    const hmac = crypto.createHmac('sha256', privateKey);
    hmac.update(data);
    return hmac.digest('hex');
}

// --- Fungsi Helper untuk Mengirim Email ---
async function sendEmail(to, subject, htmlContent) {
    const mailOptions = {
        from: EMAIL_USER,
        to: to,
        subject: subject,
        html: htmlContent,
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
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) {
        return res.status(401).json({ message: 'Unauthorized: No token provided.' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.error('JWT verification error:', err.message);
            return res.status(403).json({ message: 'Forbidden: Invalid or expired token.' });
        }
        req.user = user;
        next();
    });
};

// --- Middleware Autentikasi Admin ---
const authenticateAdmin = (req, res, next) => {
    authenticateToken(req, res, () => { // Pertama, otentikasi user
        if (req.user && req.user.isAdmin) {
            next(); // User adalah admin
        } else {
            return res.status(403).json({ message: 'Forbidden: Admin access required.' });
        }
    });
};

// --- Fungsi untuk Mengirim Notifikasi ke Discord Bot (tetap ada di code, tapi tidak akan dipanggil) ---
async function notifyDiscordBot(type, payload) {
    // Implementasi yang tidak akan dipanggil jika kita beralih ke email
    console.warn("Discord Bot notification function called, but Discord integration is replaced by email.");
    return { success: true, message: "Discord notification skipped." };
    /*
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
app.post('/api/admin/create-user', authenticateAdmin, async (req, res) => { // Endpoint ini dilindungi oleh authenticateAdmin
    // ADMIN_API_KEY_BACKEND tidak lagi diperlukan di sini karena sudah dilindungi oleh JWT admin
    console.log('DEBUG: POST /api/admin/create-user received by ADMIN.');
    console.log('DEBUG: Request body:', req.body);

    const { username, fullname, email, password } = req.body;

    if (!username || !password) {
        console.warn('DEBUG: Missing required fields (username, password) for admin user creation.');
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    try {
        const [existingUsers] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
        if (existingUsers.length > 0) {
            return res.status(409).json({ message: 'Username already taken.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUserId = uuidv4();
        
        const [result] = await pool.query(
            'INSERT INTO users(id, username, name, email, password, is_admin) VALUES(?, ?, ?, ?, ?, ?)', // is_admin default FALSE
            [newUserId, username, fullname || null, email || null, hashedPassword, false] 
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
        await sendEmail(ADMIN_EMAIL_RECEIVER, adminMailSubject, adminMailHtml);

        res.status(201).json({ message: `User "${username}" created successfully!`, userId: newUserId, userName: username });
    } catch (error) {
        console.error('ERROR: Admin user creation error:', error);
        res.status(500).json({ message: 'Error creating user.', error: error.message });
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

        if (!user) {
            return res.status(400).json({ message: 'Invalid username or password.' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
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

// Middleware to ensure user is logged in for /order access and /orders/:userId
app.use('/api/order', authenticateToken); 
app.get('/api/orders/:userId', authenticateToken, async (req, res) => {
    if (req.user.userId !== req.params.userId) {
        return res.status(403).json({ message: 'Forbidden: You can only view your own orders.' });
    }

    try {
        const [userOrders] = await pool.query('SELECT order_id AS orderId, service_type AS serviceType, imei, status, payment_method AS paymentMethod, order_date AS orderDate, amount FROM orders WHERE user_id = ? ORDER BY order_date DESC', [req.params.userId]);
        
        console.log(`Fetching orders for user ${req.params.userId}. Found ${userOrders.length} orders.`);
        res.json({ success: true, orders: userOrders }); // Tambah success:true
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
        const [pendingOrdersResult] = await pool.query("SELECT COUNT(*) AS count FROM orders WHERE status = 'Menunggu Pembayaran'");
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
    try {
        const [orders] = await pool.query("SELECT id, order_id AS orderId, user_id, customer_name AS customerName, customer_email AS customerEmail, customer_phone AS customerPhone, imei, service_type AS serviceType, payment_method AS paymentMethod, status, order_date AS orderDate, amount FROM orders ORDER BY order_date DESC");
        res.json({ success: true, orders: orders });
    } catch (error) {
        console.error('ERROR: Failed to fetch all orders for admin:', error);
        res.status(500).json({ message: 'Error fetching all orders.', error: error.message });
    }
});

app.get('/api/admin/users', authenticateAdmin, async (req, res) => {
    try {
        const [users] = await pool.query("SELECT id, username, name, email, is_admin FROM users ORDER BY created_at DESC");
        res.json({ success: true, users: users });
    } catch (error) {
        console.error('ERROR: Failed to fetch all users for admin:', error);
        res.status(500).json({ message: 'Error fetching all users.', error: error.message });
    }
});

app.post('/api/admin/update-order-status', authenticateAdmin, async (req, res) => {
    const { orderId, newStatus, initiator } = req.body; // initiator opsional

    if (!orderId || !newStatus) {
        return res.status(400).json({ message: 'Order ID and new status are required.' });
    }
    
    // Periksa status yang valid
    const validStatuses = ['Menunggu Pembayaran', 'Diproses', 'Selesai', 'Dibatalkan'];
    if (!validStatuses.includes(newStatus)) {
        return res.status(400).json({ message: 'Invalid status provided.' });
    }

    try {
        // Ambil email user terkait order untuk notifikasi
        const [orderRows] = await pool.query('SELECT o.customer_email, o.customer_name, o.username, o.service_type FROM orders o WHERE o.order_id = ?', [orderId]);
        const order = orderRows[0];

        if (!order) {
            console.warn(`DEBUG: Order ${orderId} not found for status update.`);
            return res.status(404).json({ success: false, message: `Order ${orderId} not found.` });
        }

        const [result] = await pool.query('UPDATE orders SET status = ? WHERE order_id = ?', [newStatus, orderId]);
        
        if (result.affectedRows > 0) {
            console.log(`Order ${orderId} updated to status: ${newStatus} by Admin.`);
            
            // --- Kirim Email Notifikasi ke User ---
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
                console.warn(`DEBUG: No customer email found for order ${orderId}, skipping email notification.`);
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
                callback_url: `https://back.imeihub.id/api/payment-callback`,
                return_url: `https://imeihub.id/my-orders.html`,
                expired_time: (Date.now() / 1000) + (24 * 60 * 60)
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
            await sendEmail(ADMIN_EMAIL_RECEIVER, adminMailSubject, adminMailHtml);


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
    console.log('DEBUG: Tripay callback raw body:', JSON.stringify(req.body, null, 2)); // Log body yang sudah di-parse

    // --- Verifikasi Signature Tripay ---
    const tripaySignature = req.headers['x-callback-signature'];
    const tripayEvent = req.headers['x-callback-event'];
    
    // Perhatian: req.body sudah di-parse oleh bodyParser.json(). 
    // Untuk HMAC, idealnya perlu raw body. Jika Dokploy/proxy tidak menyediakan, ini bisa jadi tantangan.
    // Jika body-parser.raw() tidak digunakan secara global, ini mungkin tidak berfungsi.
    // Asumsi: Tripay mengirimkan string JSON yang kemudian diparse.
    // Gunakan JSON.stringify(req.body) jika Anda yakin ini sesuai dengan raw body yang dikirim Tripay.
    const calculatedSignature = crypto.createHmac('sha256', TRIPAY_PRIVATE_KEY)
                                      .update(JSON.stringify(req.body)) 
                                      .digest('hex');

    if (calculatedSignature !== tripaySignature) {
        console.warn('DEBUG: Invalid Tripay callback signature!');
        return res.status(400).json({ success: false, message: 'Invalid signature.' });
    }

    if (tripayEvent !== 'transaction_updated') {
        console.warn(`DEBUG: Unhandled Tripay event: ${tripayEvent}`);
        return res.status(200).json({ success: true, message: 'Event ignored.' });
    }

    const { reference, status, amount } = req.body.data; // Sesuaikan dengan payload Tripay

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
            newStatus = 'Diproses'; // Pembayaran berhasil
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
            newStatus = 'Dibatalkan'; // Pembayaran gagal/kedaluwarsa
            notificationSubject = `Pembayaran Gagal/Kadaluarsa untuk Order ID: ${reference}`;
            notificationHtml = `
                <p>Halo ${order.customerName || order.username},</p>
                <p>Pembayaran Anda untuk Order ID <b>${reference}</b> telah gagal atau kedaluwarsa.</p>
                <p>Status pesanan Anda telah diperbarui menjadi: <b>${newStatus}</b>.</p>
                <p>Jika Anda ingin melanjutkan, mohon buat pesanan baru.</p>
                <p>Cek status terbaru Anda di <a href="https://imeihub.id/my-orders.html">Dashboard Pesanan Saya</a>.</p>
            `;
        } else if (status === 'PENDING') {
            // Notifikasi untuk pending tidak perlu jika hanya dikirim saat status berubah
            newStatus = 'Menunggu Pembayaran'; 
        } else {
            console.warn(`DEBUG: Unhandled Tripay transaction status: ${status} for order ${reference}. No status update.`);
            return res.status(200).json({ success: true, message: 'Status handled.' }); 
        }

        if (newStatus !== order.status) {
            await pool.query('UPDATE orders SET status = ?, payment_method = ?, amount = ? WHERE order_id = ?', [newStatus, order.payment_method, amount, reference]);
            console.log(`DEBUG: Order ${reference} status updated to ${newStatus} via Tripay callback.`);

            // Kirim email notifikasi ke user
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