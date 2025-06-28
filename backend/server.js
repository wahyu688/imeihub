require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const fetch = require('node-fetch'); // Pastikan ini terinstal: npm install node-fetch@2 jika Node.js < 18

const app = express();
const PORT = process.env.PORT || 3002; // FIX: process.env.PORT
const JWT_SECRET = process.env.JWT_SECRET;

// --- Discord Configurations ---
const DISCORD_BOT_UPDATE_API_URL = process.env.DISCORD_BOT_UPDATE_API_URL;
const DISCORD_ORDER_NOTIFICATION_CHANNEL_ID = process.env.DISCORD_ORDER_NOTIFICATION_CHANNEL_ID;
// ADMIN_DISCORD_USER_ID dihapus dari sini, karena cek peran dilakukan oleh bot

// --- Middleware ---
const corsOptions = {
    origin: 'http://127.0.0.1:5500', // GANTI DENGAN URL FRONTEND ANDA SAAT DEPLOY! Contoh dari Live Server VS Code
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
    optionsSuccessStatus: 204
};
app.use(cors(corsOptions));
app.use(bodyParser.json());

// --- Simulasi Database (GANTI DENGAN DATABASE SUNGGUHAN UNTUK PRODUKSI) ---
let users = [];
let orders = [];

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

// --- Fungsi untuk Mengirim Notifikasi ke Discord Bot (Backend memanggil endpoint Bot) ---
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

    if (users.find(u => u.email === email)) {
        return res.status(409).json({ message: 'Email already registered.' });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = { id: uuidv4(), name, email, password: hashedPassword };
        users.push(newUser);

        console.log('New user registered:', newUser.email);
        res.status(201).json({ message: 'User registered successfully!' });
    } catch (error) {
        console.error('Registration error:', error);
        res.status(500).json({ message: 'Error registering user.' });
    }
});

// POST /api/login - Login User
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required.' });
    }

    const user = users.find(u => u.email === email);
    if (!user) {
        return res.status(400).json({ message: 'Invalid email or password.' });
    }

    try {
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(400).json({ message: 'Invalid email or password.' });
        }

        const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '1h' });
        console.log('User logged in:', user.email);
        res.json({ message: 'Login successful', token, userId: user.id, userName: user.name });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ message: 'Error logging in.' });
    }
});

// Middleware to ensure user is logged in for /order access
app.use('/api/order', authenticateToken); 

// POST /api/order - Submit Order
app.post('/api/order', async (req, res) => {
    const userId = req.user.userId;
    const { name, email, phone, imei, serviceType, paymentMethod } = req.body;

    if (!name || !email || !phone || !imei || !serviceType || !paymentMethod) {
        return res.status(400).json({ message: 'All order fields are required.' });
    }

    const orderId = `ORD-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 100)}`;
    const newOrder = {
        id: uuidv4(),
        orderId,
        userId: userId,
        name,
        email,
        phone,
        imei,
        serviceType,
        paymentMethod,
        status: 'Menunggu Pembayaran',
        orderDate: new Date().toISOString()
    };
    orders.push(newOrder); // Simpan ke "database" sementara

    // --- Kirim Notifikasi Pesanan Baru ke Discord Bot ---
    const discordNotificationPayload = {
        type: 'new_order',
        order: {
            orderId: newOrder.orderId,
            name: newOrder.name,
            email: newOrder.email,
            phone: newOrder.phone,
            imei: newOrder.imei,
            serviceType: newOrder.serviceType,
            paymentMethod: newOrder.paymentMethod,
            status: newOrder.status,
            orderDate: newOrder.orderDate,
            channelId: DISCORD_ORDER_NOTIFICATION_CHANNEL_ID // Channel ID untuk bot mengirim notifikasi
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
});

// GET /api/orders/:userId - Get User Orders (Requires authentication)
app.get('/api/orders/:userId', authenticateToken, (req, res) => {
    if (req.user.userId !== req.params.userId) {
        return res.status(403).json({ message: 'Forbidden: You can only view your own orders.' });
    }

    const userOrders = orders.filter(order => order.userId === req.params.userId);
    console.log(`Fetching orders for user ${req.params.userId}. Found ${userOrders.length} orders.`);
    res.json({ orders: userOrders });
});

// --- Endpoint untuk Discord Bot memanggil backend untuk update status ---
// Bot Discord akan memanggil endpoint ini ketika admin memberikan perintah /update
app.post('/api/discord-webhook-commands', (req, res) => {
    const { type, payload } = req.body;

    console.log('Received command from Discord Bot:', JSON.stringify(req.body, null, 2));

    if (type === 'update_order_status' && payload && payload.orderId && payload.newStatus && payload.initiatorId) {
        const { orderId, newStatus, initiatorId } = payload;

        // VERIFIKASI ROLE DILAKUKAN DI SISI BOT DISCORD
        // Backend menerima perintah dan mengasumsikan bot sudah melakukan verifikasi izin
        // Tambahan logging untuk tujuan debugging
        console.log(`Received status update for Order ${orderId} to ${newStatus} from initiator ${initiatorId}.`);

        const orderToUpdate = orders.find(o => o.orderId === orderId);
        if (orderToUpdate) {
            orderToUpdate.status = newStatus;
            console.log(`Order ${orderId} updated to status: ${newStatus}.`);
            res.json({ success: true, message: `Status for order ${orderId} updated to ${newStatus}.` });
        } else {
            console.warn(`Order ${orderId} not found for status update.`);
            res.status(404).json({ success: false, message: `Order ${orderId} not found.` });
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