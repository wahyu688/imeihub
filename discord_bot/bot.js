require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { Client, GatewayIntentBits, Partials, EmbedBuilder, Collection } = require('discord.js');
const fetch = require('node-fetch'); // Pastikan ini terinstal: npm install node-fetch@2

const TOKEN = process.env.DISCORD_BOT_TOKEN;
const BACKEND_API_BASE_URL = process.env.BACKEND_API_BASE_URL; // URL backend utama
const DISCORD_BOT_API_PORT = process.env.DISCORD_BOT_API_PORT || 3001; // Pastikan ini sama dengan port di .env
const ADMIN_DISCORD_ROLE_ID = process.env.ADMIN_DISCORD_ROLE_ID; // ID Peran Admin dari .env

// --- Emote yang akan digunakan ---
const EMOJI_DONE = '✅';
const EMOJI_PROCESSING = '🔄';
const EMOJI_CANCEL = '❌';

// Buat client Discord baru
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions, // Diperlukan untuk mendengarkan reaksi
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
    ],
});

// Koleksi untuk menyimpan cooldown perintah (jika ada)
client.commands = new Collection();

// --- Event Listener untuk Bot Discord ---
client.once('ready', () => {
    console.log(`Discord Bot ready! Logged in as ${client.user.tag}`);
    console.log(`Backend API URL: ${BACKEND_API_BASE_URL}`);
    console.log(`Discord Bot API server running on http://localhost:${DISCORD_BOT_API_PORT}`);
    if (ADMIN_DISCORD_ROLE_ID) {
        console.log(`Admin Role ID set to: ${ADMIN_DISCORD_ROLE_ID}`);
    } else {
        console.warn('WARNING: ADMIN_DISCORD_ROLE_ID is not set in .env. Role-based update commands will not work!');
    }
});

// Event listener untuk reaksi pada pesan (untuk update status cepat)
client.on('messageReactionAdd', async (reaction, user) => {
    // Abaikan reaksi dari bot itu sendiri
    if (user.bot) return;

    // Pastikan reaction.message.partial adalah false (pesan sudah di-cache penuh)
    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            console.error('Something went wrong when fetching the message for reaction:', error);
            return;
        }
    }

    // Hanya proses reaksi pada pesan yang dikirim oleh bot ini
    if (reaction.message.author.id !== client.user.id) return;

    // Hanya proses reaksi pada pesan yang memiliki embed (asumsi embed order)
    if (!reaction.message.embeds || reaction.message.embeds.length === 0) return;

    // --- Verifikasi User yang Bereaksi Adalah Admin Berdasarkan Peran ---
    const guild = reaction.message.guild;
    if (!guild) {
        console.warn(`Reaction on DM or uncached guild. Cannot verify role for user: ${user.tag}`);
        return; // Tidak bisa cek peran di DM
    }
    
    const member = await guild.members.fetch(user.id).catch(console.error);

    if (!member) {
        console.warn(`Could not fetch guild member for user ID: ${user.id}`);
        return;
    }

    if (ADMIN_DISCORD_ROLE_ID && !member.roles.cache.has(ADMIN_DISCORD_ROLE_ID)) {
        console.warn(`Unauthorized reaction by user ${user.tag} (ID: ${user.id}). Missing required role.`);
        try {
            // Hapus reaksi dari non-admin
            await reaction.users.remove(user.id);
        } catch (error) {
            console.error('Failed to remove unauthorized reaction:', error);
        }
        return;
    }
    // --- Akhir Verifikasi Peran ---

    // Ambil Order ID dan Status saat ini dari embed pesan
    let orderId = null;
    let currentStatusInEmbed = 'Tidak Diketahui'; // Untuk logging
    const orderEmbed = reaction.message.embeds[0];

    if (orderEmbed.title && orderEmbed.title.startsWith('Pesanan Baru #')) {
        orderId = orderEmbed.title.replace('Pesanan Baru #', '');
    }
    // Mencari Order ID di fields (jika order ID dipindahkan ke fields)
    const orderIdField = orderEmbed.fields.find(field => field.name === 'Order ID');
    if(orderIdField) {
        orderId = orderIdField.value.replace(/`/g, ''); // Hapus backtick jika ada
    }

    // Mencari Status saat ini di fields (jika Status dipindahkan ke fields)
    const statusField = orderEmbed.fields.find(field => field.name === 'Status');
    if(statusField) {
        currentStatusInEmbed = statusField.value;
    }
    
    if (!orderId) {
        console.warn('Order ID not found in embed for reaction. Message ID:', reaction.message.id);
        reaction.message.channel.send(`Error: Order ID tidak ditemukan dalam pesan notifikasi ini. (${reaction.message.id})`);
        return;
    }

    let newStatus = null;
    switch (reaction.emoji.name) {
        case EMOJI_PROCESSING:
            newStatus = 'Diproses';
            break;
        case EMOJI_DONE:
            newStatus = 'Selesai';
            break;
        case EMOJI_CANCEL:
            newStatus = 'Dibatalkan';
            break;
        default:
            console.log(`Unknown emoji reaction: ${reaction.emoji.name}. Ignoring.`);
            return;
    }

    if (newStatus) {
        // Jika status yang baru sama dengan status yang ada di embed, tidak perlu update
        if (newStatus === currentStatusInEmbed) {
            console.log(`Status for order ${orderId} is already ${newStatus}. Ignoring update.`);
            try {
                // Tetap hapus reaksi admin, agar tidak terpicu berulang jika sudah sama
                await reaction.users.remove(user.id);
            } catch (error) {
                console.error('Failed to remove reaction after redundant update:', error);
            }
            return;
        }

        try {
            // Panggil API di backend server untuk update status
            const response = await fetch(`${BACKEND_API_BASE_URL}/api/discord-webhook-commands`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    type: 'update_order_status',
                    payload: {
                        orderId: orderId,
                        newStatus: newStatus,
                        initiatorId: user.id, // ID user Discord yang bereaksi
                        channelId: reaction.message.channel.id
                    }
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                console.log(`Order ${orderId} status updated to ${newStatus} via reaction.`);
                // Mengirim pesan chat baru dengan status yang diperbarui
                reaction.message.channel.send(`Status order **${orderId}** berhasil diupdate menjadi: **${newStatus}** oleh ${user.username}.`);
                
                // --- BARIS UNTUK MENGHAPUS SEMUA REAKSI SUDAH DIHILANGKAN ---
                // Sebagai gantinya, hapus reaksi user yang baru saja mengklik saja
                try {
                    await reaction.users.remove(user.id);
                } catch (error) {
                    console.error('Failed to remove reaction after update:', error);
                }

                // Opsional: Edit embed pesan notifikasi asli untuk mencerminkan status baru
                try {
                    const updatedEmbed = EmbedBuilder.from(orderEmbed) // Buat embed baru dari yang lama
                        .setFields(orderEmbed.fields.map(field => {
                            if (field.name === 'Status') {
                                field.value = newStatus; // Update nilai status
                            }
                            return field;
                        }))
                        .setColor(newStatus === 'Selesai' ? 0x00ff00 : newStatus === 'Diproses' ? 0xffff00 : newStatus === 'Dibatalkan' ? 0xff0000 : 0x0099ff); // Ubah warna embed berdasarkan status
                    
                    await reaction.message.edit({ embeds: [updatedEmbed] });
                    console.log(`Original embed for order ${orderId} updated.`);
                } catch (editError) {
                    console.error('Failed to edit original embed message:', editError);
                }

            } else {
                console.error(`Failed to update order ${orderId} status via reaction: ${data.message || 'Server error.'}`);
                reaction.message.channel.send(`Gagal mengupdate status order **${orderId}**: ${data.message || 'Terjadi kesalahan di server.'}`);
            }
        } catch (error) {
            console.error('Error calling backend API for status update via reaction:', error);
            reaction.message.channel.send('Terjadi masalah saat berkomunikasi dengan server backend untuk update status. Coba lagi nanti.');
        }
    }
});


// Login bot ke Discord
client.login(TOKEN);

// --- Endpoint Express untuk Backend Utama Memanggil Bot untuk Notifikasi ---
const botApp = express();
botApp.use(bodyParser.json());

// Endpoint ini dipanggil oleh server.js (backend utama) ketika ada order baru
botApp.post('/api/discord-bot-notify', async (req, res) => {
    const { type, payload } = req.body;

    if (type === 'new_order' && payload && payload.order) {
        const order = payload.order;
        const channelId = payload.order.channelId; // Channel ID dari payload backend

        if (!channelId) {
            console.error("Channel ID not provided in new_order payload.");
            return res.status(400).json({ success: false, message: "Channel ID is required for new_order." });
        }

        const channel = client.channels.cache.get(channelId);

        if (!channel) {
            console.error(`Channel with ID ${channelId} not found.`);
            return res.status(404).json({ success: false, message: `Discord channel with ID ${channelId} not found.` });
        }

        try {
            // Membuat Embed untuk Notifikasi Pesanan Baru (Hanya menampilkan Order ID, Username, IMEI, Status)
            const newOrderEmbed = new EmbedBuilder()
                .setColor(0x0099ff) // Warna biru default
                .setTitle(`Pesanan Baru #${order.orderId}`)
                .setURL(`${BACKEND_API_BASE_URL}/admin/orders/${order.orderId}`) // Contoh URL ke halaman admin (jika ada)
                .setDescription(`Detail pesanan baru telah diterima.`)
                .addFields(
                    { name: 'Order ID', value: `\`${order.orderId}\``, inline: false }, // Order ID di atas agar mudah terlihat
                    { name: 'Nama Pelanggan', value: order.name, inline: true },
                    { name: 'IMEI', value: `\`${order.imei}\``, inline: true },
                    { name: 'Status', value: order.status, inline: true },
                    // Hapus field lainnya
                )
                .setTimestamp()
                .setFooter({ text: `Order ID: ${order.orderId} | Dibuat oleh: ${order.name}` }); // Footer tetap ada untuk data lengkap

            const message = await channel.send({ embeds: [newOrderEmbed] });

            // Tambahkan reaksi untuk update status cepat
            await message.react(EMOJI_PROCESSING); // Reaksi untuk "Diproses"
            await message.react(EMOJI_DONE);        // Reaksi untuk "Selesai"
            await message.react(EMOJI_CANCEL);      // Reaksi untuk "Dibatalkan"

            console.log(`New order notification sent to Discord channel ${channel.name} (${channel.id}).`);
            res.status(200).json({ message: 'New order notification sent successfully to Discord.' });

        } catch (error) {
            console.error('Error sending new order notification to Discord:', error);
            res.status(500).json({ message: 'Failed to send new order notification to Discord.' });
        }
    } else {
        console.warn('Unknown notification type or invalid payload received:', req.body);
        res.status(400).json({ message: 'Invalid notification type or payload.' });
    }
});


// --- Start Express API Server untuk Bot ---
const BOT_PORT = process.env.DISCORD_BOT_API_PORT || 3001; // Pastikan ini sama dengan port di .env
botApp.listen(BOT_PORT, () => {
    console.log(`Discord Bot API server running on http://localhost:${BOT_PORT}`);
});