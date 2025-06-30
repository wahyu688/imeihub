require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');
const crypto = require('crypto');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_API_KEY_BACKEND = process.env.ADMIN_API_KEY_BACKEND;

// --- Discord Configurations (Konstanta tetap ada, tapi tidak digunakan) ---
const DISCORD_BOT_UPDATE_API_URL = process.env.DISCORD_BOT_UPDATE_API_URL;
const DISCORD_ORDER_NOTIFICATION_CHANNEL_ID = process.env.DISCORD_ORDER_NOTIFICATION_CHANNEL_ID;
const ADMIN_DISCORD_USER_ID = process.env.ADMIN_DISCORD_USER_ID;

// --- Email Configuration (Nodemailer) ---
const EMAIL_SERVICE = process.env.EMAIL_SERVICE;
const EMAIL_HOST = process.env.EMAIL_HOST;
const EMAIL_PORT_SMTP = process.env.EMAIL_PORT_SMTP;
const EMAIL_SECURE = process.env.EMAIL_SECURE === 'true';
const EMAIL_USER = process.env.EMAIL_USER;
const EMAIL_PASSWORD = process.env.EMAIL_PASSWORD;
const ADMIN_EMAIL_RECEIVER = process.env.ADMIN_EMAIL_RECEIVER;

const transporter = nodemailer.createTransport({
    host: EMAIL_HOST || null,
    port: EMAIL_PORT_SMTP ? parseInt(EMAIL_PORT_SMTP, 10) : null,
    secure: EMAIL_SECURE,
    auth: {
        user: EMAIL_USER,
        pass: EMAIL_PASSWORD,
    },
    connectionTimeout: 10 * 1000,
    socketTimeout: 30 * 1000
});

transporter.verify(function(error, success) {
    if (error) {
        console.error('ERROR: Nodemailer transporter verification failed:', error);
        console.error('ERROR: Please check EMAIL_SERVICE, EMAIL_HOST, EMAIL_PORT_SMTP, EMAIL_SECURE, EMAIL_USER, EMAIL_PASSWORD in Dokploy Environment Variables.');
        process.exit(1);
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
    origin: 'https://imeihub.id', // Pastikan ini sama persis dengan URL frontend Anda
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    optionsSuccessStatus: 204
};
app.use(cors(corsOptions));
app.set('trust proxy', true);
app.use(bodyParser.json());

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
    authenticateToken(req, res, () => {
        if (req.user && req.user.isAdmin) {
            next();
        } else {
            return res.status(403).json({ message: 'Forbidden: Admin access required.' });
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
            'INSERT INTO users(id, username, name, email, password, is_admin) VALUES(?, ?, ?, ?, ?, ?)',
            [newUserId, username, fullname || null, email || null, hashedPassword, false]
        );

        console.log('New user created by admin:', username);
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
        const [users] = await pool.query('SELECT id, username, name, email, password, is_admin FROM users WHERE username = ?', [username]);
        const user = users[0];

        if (!user) {
            return res.status(400).json({ message: 'Invalid username or password.' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: 'Invalid username or password.' });
        }

        const token = jwt.sign({ userId: user.id, isAdmin: user.is_admin }, JWT_SECRET);
        console.log('User logged in:', user.username);
        res.json({ message: 'Login successful', token, userId: user.id, userName: user.name || user.username, isAdmin: user.is_admin });
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
        const [pendingOrdersResult] = await pool.query("SELECT COUNT(*) AS count FROM orders WHERE status = 'Menunggu Pembayaran' OR status = 'Menunggu Proses Besok'");
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
    const searchName = req.query.searchName || ''; // Ambil parameter searchName

    console.log(`DEBUG_BACKEND: Fetching admin orders. SortBy: ${sortBy}, SearchName: ${searchName}`); // DEBUG LOG

    const validSortColumns = ['order_date', 'order_id', 'customer_name', 'status', 'amount'];
    const [column, order] = sortBy.split(' ');
    if (!validSortColumns.includes(column) || !['ASC', 'DESC'].includes(order)) {
        console.warn(`DEBUG_BACKEND: Invalid sortBy parameter received: ${sortBy}. Using default.`);
        // Fallback ke default jika parameter tidak valid
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
        const [users] = await pool.query("SELECT id, username, name, email, is_admin FROM users ORDER BY created_at DESC");
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

    const validStatuses = ['Menunggu Pembayaran', 'Diproses', 'Selesai', 'Dibatalkan', 'Menunggu Proses Besok'];
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
    const { name, email, phone, imei, serviceType } = req.body;

    const amount = SERVICE_PRICES[serviceType];
    if (!amount) {
        console.warn(`DEBUG: Invalid or undefined amount for service type: ${serviceType}`);
        return res.status(400).json({ success: false, message: `Price not defined for service: ${serviceType}` });
    }

    if (!name || !email || !phone || !imei || !serviceType) {
        return res.status(400).json({ message: 'All order fields are required.' });
    }

    const orderId = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 100)}`;
    const newOrderId = uuidv4();

    // --- LOGIKA JAM BISNIS UNTUK STATUS AWAL ORDER ---
    const now = new Date();
    const currentHour = now.getHours(); // Jam lokal server (UTC di container)
    const businessStartHour = 7; // 7 AM
    const businessEndHour = 17; // 5 PM (17:00)

    let initialStatus = 'Menunggu Pembayaran'; // Default status
    if (currentHour < businessStartHour || currentHour >= businessEndHour) {
        initialStatus = 'Menunggu Proses Besok'; // Di luar jam kerja
    }
    console.log(`DEBUG: Order placed at hour ${currentHour}. Initial status set to: ${initialStatus}`);


    try {
        await pool.query(
            'INSERT INTO orders(id, order_id, user_id, customer_name, customer_email, customer_phone, imei, service_type, status, order_date, amount) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), ?)',
            [newOrderId, orderId, userId, name, email, phone, imei, serviceType, initialStatus, amount] // Gunakan initialStatus
        );
        console.log(`Order ${orderId} saved to database.`);

        const adminMailSubject = `New Order Received: ${orderId} (${serviceType})`;
        const adminMailHtml = `
            <p>New order received from ${name} (${email}):</p>
            <ul>
                <li>Order ID: <b>${orderId}</b></li>
                <li>Service: ${serviceType}</li>
                <li>IMEI: ${imei}</li>
                <li>Amount: Rp ${amount.toLocaleString('id-ID')}</li>
                <li>Status: ${initialStatus}</li> <!-- Status di email admin -->
                <li>Customer Phone: ${phone}</li>
            </ul>
            <p>Check admin dashboard for more details: <a href="https://imeihub.id/admin_dashboard.html">Admin Dashboard</a></p>
        `;
        console.log('DEBUG: Attempting to send email for new order notification.');
        await sendEmail(ADMIN_EMAIL_RECEIVER, adminMailSubject, adminMailHtml);
        console.log('DEBUG: Email sent for new order notification.');


        res.status(200).json({
            success: true,
            message: 'Order submitted successfully.',
            orderId: orderId,
            amount: amount,
            initialStatus: initialStatus // Kirim status awal ke frontend
        });

    } catch (error) {
        console.error('ERROR: Order submission request failed:', error);
        res.status(500).json({ success: false, message: 'Internal server error during order submission.', error: error.message });
    }
});

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
