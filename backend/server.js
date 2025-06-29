require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid'); // Digunakan untuk menghasilkan ID unik
const fetch = require('node-fetch'); // Pastikan ini terinstal: npm install node-fetch@2 jika Node.js < 18

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

// --- Discord Configurations (akan diambil dari .env Dokploy) ---
const DISCORD_BOT_UPDATE_API_URL = process.env.DISCORD_BOT_UPDATE_API_URL;
const DISCORD_ORDER_NOTIFICATION_CHANNEL_ID = process.env.DISCORD_ORDER_NOTIFICATION_CHANNEL_ID;
const ADMIN_DISCORD_USER_ID = process.env.ADMIN_DISCORD_USER_ID;

// --- Database Configuration (MySQL) ---
const mysql = require('mysql2/promise'); // Impor driver mysql2/promise

const pool = mysql.createPool({ // Menggunakan createPool untuk koneksi pool
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT, // Pastikan ini angka, bukan string di .env (Dokploy akan handle)
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Test database connection on startup (akan muncul di log Dokploy)
pool.getConnection()
    .then(connection => {
        console.log('DEBUG: Successfully connected to MySQL database.');
        connection.release(); // Lepaskan koneksi setelah tes
    })
    .catch(err => {
        console.error('ERROR: Failed to connect to MySQL database:', err);
        console.error('ERROR: Please check your DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME in Dokploy Environment Variables.');
        process.exit(1); // Keluar dari proses jika koneksi database gagal
    });

// --- Middleware ---
const corsOptions = {
    // Pastikan ini cocok dengan URL publik frontend Anda di Dokploy (misal: https://your-frontend-app.dokploy.com)
    // Selama pengembangan lokal, gunakan http://127.0.0.1:5500 (dari Live Server VS Code)
    origin: 'http://127.0.0.1:5500', 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    optionsSuccessStatus: 204
};
app.use(cors(corsOptions));
app.use(bodyParser.json());

// --- Hapus array simulasi ini ---
// let users = [];
// let orders = [];

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

// --- Fungsi untuk Mengirim Notifikasi ke Discord Bot ---
async function notifyDiscordBot(type, payload) {
    if (!DISCORD_BOT_UPDATE_API_URL) {
        console.warn("Discord Bot Update API URL not configured. Notification not sent.");
        return { success: false, message: "Discord Bot API not configured." };
    }

    try {
        const response = await fetch(DISCORD_BOT_UPDATE_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
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
}


// --- API Endpoints ---

// POST /api/register - Register User
app.post('/api/register', async (req, res) => {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
        return res.status(400).json({ message: 'Name, email, and password are required.' });
    }

    try {
        // Cek apakah user sudah ada di database
        const [existingUsers] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUsers.length > 0) {
            return res.status(409).json({ message: 'Email already registered.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUserId = uuidv4(); // Generate UUID di sisi Node.js
        
        // Masukkan user baru ke database
        const [result] = await pool.query(
            'INSERT INTO users(id, name, email, password) VALUES(?, ?, ?, ?)',
            [newUserId, name, email, hashedPassword]
        );

        console.log('New user registered:', email);
        res.status(201).json({ message: 'User registered successfully!', userId: newUserId, userName: name });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Error registering user.', error: error.message });
    }
});

// POST /api/login - Login User
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    try {
        // Cari user di database
        const [users] = await pool.query('SELECT id, name, password FROM users WHERE email = ?', [email]);
        const user = users[0]; // Ambil user jika ditemukan

        if (!user) {
            return res.status(400).json({ message: 'Invalid email or password.' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: 'Invalid email or password.' });
        }

        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });
        console.log('User logged in:', user.email);
        res.json({ message: 'Login successful', token, userId: user.id, userName: user.name });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Error logging in.', error: error.message });
    }
});

// Middleware to ensure user is logged in for /order access
app.use('/api/order', authenticateToken); 

// POST /api/order - Submit Order
app.post('/api/order', async (req, res) => {
    const userId = req.user.userId; // user ID dari token JWT
    const { name, email, phone, imei, serviceType, paymentMethod } = req.body;

    if (!name || !email || !phone || !imei || !serviceType || !paymentMethod) {
        return res.status(400).json({ message: 'All order fields are required.' });
    }

    const orderId = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 100)}`; // Order ID yang bisa dilihat user
    const newOrderId = uuidv4(); // UUID untuk ID primer tabel orders

    try {
        // Masukkan order baru ke tabel orders
        await pool.query(
            'INSERT INTO orders(id, order_id, user_id, customer_name, customer_email, customer_phone, imei, service_type, payment_method, status, order_date) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
            [newOrderId, orderId, userId, name, email, phone, imei, serviceType, paymentMethod, 'Menunggu Pembayaran']
        );

        // --- Kirim Notifikasi Pesanan Baru ke Discord Bot ---
        const discordNotificationPayload = {
            type: 'new_order',
            order: {
                orderId: orderId, // Gunakan orderId yang kita buat untuk notifikasi
                name: name,
                email: email,
                phone: phone,
                imei: imei,
                serviceType: serviceType,
                paymentMethod: paymentMethod,
                status: 'Menunggu Pembayaran',
                orderDate: new Date().toISOString(),
                channelId: DISCORD_ORDER_NOTIFICATION_CHANNEL_ID
            }
        };

        const notifyResult = await notifyDiscordBot('new_order', discordNotificationPayload);

        if (notifyResult.success) {
            console.log(`Order ${orderId} received. Discord Bot notified.`);
            res.status(201).json({ message: 'Order received and Discord Bot notified.', orderId: orderId });
        } else {
            console.error(`Order ${orderId} received, but Discord Bot notification failed: ${notifyResult.message}`);
            // Mengembalikan status 202 Accepted untuk menunjukkan bahwa order diterima di backend
            // tapi ada masalah notifikasi
            res.status(202).json({ message: 'Order received, but failed to notify Discord Bot. Please check logs.', orderId: orderId });
        }
    } catch (error) {
        console.error('Order submission error:', error);
        res.status(500).json({ message: 'Error submitting order.', error: error.message });
    }
});

// GET /api/orders/:userId - Get User Orders (Requires authentication)
app.get('/api/orders/:userId', authenticateToken, async (req, res) => { // Tambah 'async'
    if (req.user.userId !== req.params.userId) {
        return res.status(403).json({ message: 'Forbidden: You can only view your own orders.' });
    }

    try {
        // Mengambil orders dari database untuk user tertentu
        const [userOrders] = await pool.query('SELECT order_id AS orderId, service_type AS serviceType, imei, status, payment_method AS paymentMethod, order_date AS orderDate FROM orders WHERE user_id = ? ORDER BY order_date DESC', [req.params.userId]);
        
        console.log(`Fetching orders for user ${req.params.userId}. Found ${userOrders.length} orders.`);
        res.json({ orders: userOrders });
    }
     catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ message: 'Error fetching orders.', error: error.message });
    }
});

// --- Endpoint untuk Discord Bot memanggil backend untuk update status ---
// Bot Discord akan memanggil endpoint ini ketika admin memberikan perintah /update
app.post('/api/discord-webhook-commands', async (req, res) => { // Tambah 'async'
    const { type, payload } = req.body;

    console.log('Received command from Discord Bot:', JSON.stringify(payload, null, 2));

    if (type === 'update_order_status' && payload && payload.orderId && payload.newStatus && payload.initiatorId) {
        const { orderId, newStatus, initiatorId } = payload;

        // Verifikasi peran dilakukan di sisi bot Discord (kita percaya bot)
        console.log(`Received status update for Order ${orderId} to ${newStatus} from initiator ${initiatorId}.`);

        try {
            // Update status di database MySQL
            const [result] = await pool.query('UPDATE orders SET status = ? WHERE order_id = ?', [newStatus, orderId]);
            
            if (result.affectedRows > 0) { // affectedRows > 0 berarti ada baris yang di-update
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
app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
    if (JWT_SECRET === 'your_super_secret_jwt_key_please_change_this_to_a_random_string_in_production') {
        console.warn('WARNING: JWT_SECRET is not changed. Please update it in your .env file for production!');
    }
});