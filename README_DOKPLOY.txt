PETUNJUK LENGKAP UNTUK WEBSITE UNLOCK IMEI FULL-STACK ANDA (DENGAN DOKPLOY & DOCKER)

==================================================
BAGIAN 1: TINJAUAN ARSITEKTUR & FITUR UTAMA
==================================================
Aplikasi Anda akan berjalan dalam kontainer Docker:
-   **frontend:** Kontainer Nginx yang menyajikan file HTML/CSS/JS statis.
-   **backend:** Kontainer Node.js yang menjalankan server API utama Anda.
-   **discord_bot:** Kontainer Node.js yang menjalankan bot Discord Anda.

Fitur Utama:
-   Halaman Beranda, Layanan, Kontak.
-   Sistem Login dan Registrasi Akun untuk User.
-   Halaman Order yang terproteksi (HANYA bisa diakses setelah Login).
-   Halaman "Pesanan Saya" yang terproteksi (HANYA bisa diakses setelah Login) untuk melihat status pesanan.
-   Notifikasi Pesanan Baru ke Channel Discord Admin secara otomatis (melalui Discord Bot).
-   Update Status Pesanan melalui reaksi emote di Discord oleh Admin (status akan terlihat di halaman "Pesanan Saya").
-   UI yang konsisten dengan desain modern dan responsif.

==================================================
BAGIAN 2: PRASYARAT
==================================================

1.  **VPS (Virtual Private Server):** Anda memerlukan VPS (misalnya dari Hostinger, Dewaweb, Linode, DigitalOcean) tempat Dokploy akan diinstal. Pastikan VPS menjalankan Linux (misal Ubuntu LTS).
2.  **Akses SSH:** Anda memiliki akses SSH ke VPS Anda.
3.  **Domain (Direkomendasikan):** Memiliki domain akan membuat akses ke website lebih mudah dan memungkinkan HTTPS.
4.  **Repositori Git:** Kode *full-stack* Anda (termasuk semua file yang tercantum di atas) harus sudah diunggah ke repositori GitHub/GitLab/Bitbucket.
5.  **Variabel Lingkungan di Discord Developer Portal:** Pastikan Anda sudah mendapatkan dan siap menggunakan:
    * **Discord Bot Token:** Dari aplikasi bot Anda di Discord Developer Portal.
    * **Discord Channel ID:** ID channel tempat notifikasi order akan dikirim.
    * **Discord Admin Role ID:** ID peran admin yang akan digunakan untuk memverifikasi update status.

==================================================
BAGIAN 3: INSTALASI & SETUP DOKPLOY DI VPS ANDA
==================================================

1.  **Akses VPS Anda via SSH:**
    ```bash
    ssh user@your_vps_ip_address
    ```
2.  **Instal Dokploy:** Ikuti instruksi instalasi Dokploy dari dokumentasi resmi mereka. Ini biasanya melibatkan menjalankan sebuah skrip:
    ```bash
    # Update sistem
    sudo apt update && sudo apt upgrade -y

    # Instal Dokploy (ikuti petunjuk dari dokumentasi Dokploy yang terbaru)
    # Contoh: curl -sSL [https://get.dokploy.com](https://get.dokploy.com) | sudo bash
    ```
    Ini akan menginstal Docker, Docker Compose, dan komponen Dokploy lainnya. VPS mungkin perlu di-reboot.
3.  **Akses Dashboard Dokploy:** Setelah instalasi, Dokploy akan memberikan URL untuk mengakses *dashboard* web-nya (misalnya `https://your_vps_ip_address:8080`). Akses URL ini di browser Anda untuk *setup* awal Dokploy.

==================================================
BAGIAN 4: KONFIGURASI PROYEK UNTUK DOKPLOY
==================================================

Pastikan semua `Dockerfile`s, `nginx.conf`, dan `docker-compose.yml` berada di *root* repositori Git Anda seperti yang dijelaskan dalam struktur file di atas.

1.  **File `.env` Utama:**
    * Buat file `.env` di *root* folder proyek Anda.
    * Isi dengan semua variabel lingkungan yang digunakan oleh `docker-compose.yml` (seperti `JWT_SECRET`, `DISCORD_BOT_TOKEN`, `DISCORD_ORDER_NOTIFICATION_CHANNEL_ID`, `ADMIN_DISCORD_USER_ID`, `ADMIN_DISCORD_ROLE_ID`).
    * **JANGAN COMMIT FILE `.env` ini ke Git.**

2.  **Perbarui `public_html/script.js`:**
    * Pastikan `API_BASE_URL` di file ini menunjuk ke **URL publik *frontend* Anda** (domain Anda atau IP VPS Anda).
    * Contoh: `const API_BASE_URL = 'http://yourdomain.com';` (atau `http://your_vps_ip_address`).

==================================================
BAGIAN 5: DEPLOY MELALUI DOKPLOY DASHBOARD
==================================================

1.  **Buat Proyek Baru di Dokploy Dashboard:**
    * Login ke Dokploy Dashboard.
    * Buat proyek baru.
    * Hubungkan ke repositori Git Anda. Pilih *branch* yang akan di-deploy (misal `main`).

2.  **Konfigurasi Variabel Lingkungan di Dokploy:**
    * Dokploy akan memiliki bagian untuk mengelola variabel lingkungan (sering disebut "Environment Variables" atau "Secrets").
    * Masukkan semua variabel dari file `.env` utama Anda ke sini. Dokploy akan secara aman menyuntikkannya ke kontainer Anda.

3.  **Konfigurasi Port & Domain di Dokploy:**
    * Dokploy akan secara otomatis mendeteksi *service* di `docker-compose.yml` Anda.
    * Pastikan *port* 80 dari *service* `frontend` Anda (yang diekspos di `docker-compose.yml`) diatur untuk diakses secara publik.
    * Tambahkan domain Anda (jika ada) di pengaturan Dokploy. Dokploy sering menyediakan fitur SSL/HTTPS otomatis dengan Let's Encrypt.

4.  **Memicu Deploy:**
    * Klik tombol "Deploy" di Dokploy Dashboard.
    * Dokploy akan menarik kode Anda, membangun *image* Docker, dan menjalankan kontainer Anda. Anda akan dapat melihat *log* *deployment* langsung di *dashboard*.

==================================================
BAGIAN 6: UJI COBA APLIKASI
==================================================

1.  **Akses Frontend Anda:** Buka URL publik yang diberikan oleh Dokploy (domain Anda atau IP VPS) di *browser*.
2.  **Uji Coba Pendaftaran & Login:** Lakukan alur registrasi dan login.
3.  **Uji Coba Pemesanan:** Buat pesanan baru. Periksa *log* di *dashboard* Dokploy Anda (untuk *backend* dan *discord_bot*) dan pastikan notifikasi masuk ke channel Discord Anda.
4.  **Uji Coba Update Status:** Gunakan reaksi *emote* di Discord untuk mengupdate status pesanan. Verifikasi *log* bot dan backend, serta perubahan status di halaman "Pesanan Saya" di *website*.

Dokploy akan sangat menyederhanakan manajemen Docker dan *deployment* Anda, tetapi proses instalasi Dokploy itu sendiri di VPS harus dilakukan dengan cermat.