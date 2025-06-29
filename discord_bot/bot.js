require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { Client, GatewayIntentBits, Partials, EmbedBuilder, Collection } = require('discord.js');
const fetch = require('node-fetch'); // Pastikan ini terinstal: npm install node-fetch@2

// --- Discord Bot Configuration ---
const TOKEN = process.env.DISCORD_BOT_TOKEN;
const BACKEND_API_BASE_URL = process.env.BACKEND_API_BASE_URL;
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
        GatewayIntentBits.GuildMessageReactions,
    ],
    partials: [
        Partials.Message,
        Partials.Channel,
        Partials.Reaction,
    ],
});

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

client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;

    if (reaction.partial) {
        try {
            await reaction.fetch();
        } catch (error) {
            console.error('Something went wrong when fetching the message for reaction:', error);
            return;
        }
    }

    if (reaction.message.author.id !== client.user.id) return;

    if (!reaction.message.embeds || reaction.message.embeds.length === 0) return;

    const guild = reaction.message.guild;
    if (!guild) {
        console.warn(`Reaction on DM or uncached guild. Cannot verify role for user: ${user.tag}`);
        return;
    }
    
    const member = await guild.members.fetch(user.id).catch(console.error);

    if (!member) {
        console.warn(`Could not fetch guild member for user ID: ${user.id}`);
        return;
    }

    if (ADMIN_DISCORD_ROLE_ID && !member.roles.cache.has(ADMIN_DISCORD_ROLE_ID)) {
        console.warn(`Unauthorized reaction by user ${user.tag} (ID: ${user.id}). Missing required role.`);
        try {
            await reaction.users.remove(user.id);
        } catch (error) {
            console.error('Failed to remove unauthorized reaction:', error);
        }
        return;
    }

    let orderId = null;
    let currentStatusInEmbed = 'Tidak Diketahui';
    const orderEmbed = reaction.message.embeds[0];

    const orderIdField = orderEmbed.fields.find(field => field.name === 'Order ID');
    if(orderIdField) {
        orderId = orderIdField.value.replace(/`/g, '');
    }

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
        if (newStatus === currentStatusInEmbed) {
            console.log(`Status for order ${orderId} is already ${newStatus}. Ignoring update.`);
            try {
                await reaction.users.remove(user.id);
            } catch (error) {
                console.error('Failed to remove reaction after redundant update:', error);
            }
            return;
        }

        try {
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
                        initiatorId: user.id,
                        channelId: reaction.message.channel.id
                    }
                })
            });

            const data = await response.json();

            if (response.ok && data.success) {
                console.log(`Order ${orderId} status updated to ${newStatus} via reaction.`);
                reaction.message.channel.send(`Status order **${orderId}** berhasil diupdate menjadi: **${newStatus}** oleh ${user.username}.`);
                
                try {
                    await reaction.users.remove(user.id);
                } catch (error) {
                    console.error('Failed to remove reaction after update:', error);
                }

                try {
                    const updatedEmbed = EmbedBuilder.from(orderEmbed)
                        .setFields(orderEmbed.fields.map(field => {
                            if (field.name === 'Status') {
                                field.value = newStatus;
                            }
                            return field;
                        }))
                        .setColor(newStatus === 'Selesai' ? 0x00ff00 : newStatus === 'Diproses' ? 0xffff00 : newStatus === 'Dibatalkan' ? 0xff0000 : 0x0099ff);
                    
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
        const channelId = payload.order.channelId;

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
            const newOrderEmbed = new EmbedBuilder()
                .setColor(0x0099ff)
                .setTitle(`Pesanan Baru #${order.orderId}`)
                .setURL(`${BACKEND_API_BASE_URL}/admin/orders/${order.orderId}`)
                .setDescription(`Detail pesanan baru telah diterima.`)
                .addFields(
                    { name: 'Order ID', value: `\`${order.orderId}\``, inline: false },
                    { name: 'Nama Pelanggan', value: order.name, inline: true },
                    { name: 'IMEI', value: `\`${order.imei}\``, inline: true },
                    { name: 'Status', value: order.status, inline: true },
                )
                .setTimestamp()
                .setFooter({ text: `Order ID: ${order.orderId} | Dibuat oleh: ${order.name}` });

            const message = await channel.send({ embeds: [newOrderEmbed] });

            await message.react(EMOJI_PROCESSING);
            await message.react(EMOJI_DONE);
            await message.react(EMOJI_CANCEL);

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
const BOT_PORT = process.env.DISCORD_BOT_API_PORT || 3001;
botApp.listen(BOT_PORT, () => {
    console.log(`Discord Bot API server running on http://localhost:${BOT_PORT}`);
});