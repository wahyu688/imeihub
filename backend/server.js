require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;
const ADMIN_API_KEY_BACKEND = process.env.ADMIN_API_KEY_BACKEND; // API Key untuk endpoint admin

// --- Discord Configurations ---
const DISCORD_BOT_UPDATE_API_URL = process.env.DISCORD_BOT_UPDATE_API_URL;
const DISCORD_ORDER_NOTIFICATION_CHANNEL_ID = process.env.DISCORD_ORDER_NOTIFICATION_CHANNEL_ID;
const ADMIN_DISCORD_USER_ID = process.env.ADMIN_DISCORD_USER_ID;

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

app.use(bodyParser.json());


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

// POST /api/admin/create-user - Endpoint Admin untuk Membuat Akun User
// Endpoint ini dilindungi oleh ADMIN_API_KEY
app.post('/api/admin/create-user', async (req, res) => {
    const adminApiKey = req.headers['x-admin-api-key']; // Ambil API Key dari header
    console.log('DEBUG: POST /api/admin/create-user received.');
    console.log('DEBUG: Request body:', req.body);

    if (!adminApiKey || adminApiKey !== ADMIN_API_KEY_BACKEND) {
        console.warn('DEBUG: Unauthorized attempt to create user (invalid API Key).');
        return res.status(401).json({ message: 'Unauthorized: Invalid Admin API Key.' });
    }

    const { username, fullname, email, password } = req.body; // Ambil username, fullname, email

    if (!username || !password) { // Hanya username dan password yang wajib
        console.warn('DEBUG: Missing required fields (username, password) for admin user creation.');
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    try {
        // Cek apakah username sudah ada
        const [existingUsers] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
        if (existingUsers.length > 0) {
            return res.status(409).json({ message: 'Username already taken.' }); // Pesan diubah
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUserId = uuidv4();
        
        // Masukkan user baru ke database, dengan username, fullname, dan email opsional
        const [result] = await pool.query(
            'INSERT INTO users(id, username, name, email, password) VALUES(?, ?, ?, ?, ?)',
            [newUserId, username, fullname || null, email || null, hashedPassword] // fullname dan email bisa null
        );

        console.log('New user created by admin:', username); // Log pakai username
        res.status(201).json({ message: `User "${username}" created successfully!`, userId: newUserId, userName: username }); // Respon pakai username
    } catch (error) {
        console.error('ERROR: Admin user creation error:', error);
        res.status(500).json({ message: 'Error creating user.', error: error.message });
    }
});


// POST /api/login - Login User (Publik)
// Endpoint ini sekarang login dengan USERNAME
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body; // Ambil username, bukan email

    if (!username || !password) { // Cek username dan password
        return res.status(400).json({ message: 'Username and password are required.' });
    }

    try {
        const [users] = await pool.query('SELECT id, username, name, email, password FROM users WHERE username = ?', [username]); // Cari berdasarkan username
        const user = users[0];

        if (!user) {
            return res.status(400).json({ message: 'Invalid username or password.' }); // Pesan error diubah
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: 'Invalid username or password.' }); // Pesan error diubah
        }

        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });
        console.log('User logged in:', user.username); // Log pakai username
        res.json({ message: 'Login successful', token, userId: user.id, userName: user.name || user.username }); //userName bisa nama asli atau username
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
        const [userOrders] = await pool.query('SELECT order_id AS orderId, service_type AS serviceType, imei, status, payment_method AS paymentMethod, order_date AS orderDate FROM orders WHERE user_id = ? ORDER BY order_date DESC', [req.params.userId]);
        
        console.log(`Fetching orders for user ${req.params.userId}. Found ${userOrders.length} orders.`);
        res.json({ orders: userOrders });
    }
     catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).json({ message: 'Error fetching orders.', error: error.message });
    }
});

// POST /api/order - Submit Order
app.post('/api/order', async (req, res) => {
    const userId = req.user.userId;
    // Ambil detail nama dan email dari user yang login (dari DB)
    const [userRows] = await pool.query('SELECT name, email, username FROM users WHERE id = ?', [userId]);
    const loggedInUser = userRows[0];
    if (!loggedInUser) {
        console.error('ERROR: Logged in user not found in DB for order creation:', userId);
        return res.status(400).json({ message: 'Logged in user data not found.' });
    }

    const { phone, imei, serviceType, paymentMethod } = req.body; // fullname dan email tidak lagi dari form order

    if (!phone || !imei || !serviceType || !paymentMethod) {
        return res.status(400).json({ message: 'All order fields are required.' });
    }

    const orderId = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 100)}`;
    const newOrderId = uuidv4();

    try {
        await pool.query(
            'INSERT INTO orders(id, order_id, user_id, customer_name, customer_email, customer_phone, imei, service_type, payment_method, status, order_date) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())',
            [newOrderId, orderId, userId, loggedInUser.name || loggedInUser.username, loggedInUser.email || null, phone, imei, serviceType, paymentMethod, 'Menunggu Pembayaran'] // Nama dan email dari DB user
        );

        const discordNotificationPayload = {
            type: 'new_order',
            order: {
                orderId: orderId,
                name: loggedInUser.name || loggedInUser.username, // Nama yang ditampilkan di Discord
                email: loggedInUser.email || 'N/A', // Email yang ditampilkan di Discord
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
            res.status(202).json({ message: 'Order received, but failed to notify Discord Bot. Please check logs.', orderId: orderId });
        }
    } catch (error) {
        console.error('Order submission error:', error);
        res.status(500).json({ message: 'Error submitting order.', error: error.message });
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