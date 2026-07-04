# Linen Management System

Aplikasi monitoring pengelolaan linen untuk **Rumah Sakit**, **Valet** (pengantar/penjemput linen), dan **Admin**.

## Role & Alur

| Role      | Tugas                                                    |
| --------- | -------------------------------------------------------- |
| **Valet** | Pagi hari menjemput linen kotor & mengantar linen bersih, mengisi form serah terima |
| **Admin** | Memverifikasi form serah terima yang diisi valet         |
| **RS**    | Memantau status pengiriman dan riwayat linen             |

**Alur:** Valet jemput linen → isi form serah terima → Admin verifikasi → RS pantau.

## Struktur

```
├── api/              # Backend Express (routes, controllers, models)
├── src/              # Frontend React (components, pages, hooks)
├── public/           # Static assets
├── server.js         # Entry point Express
├── vite.config.js    # Konfigurasi Vite
└── package.json      # Dependencies & scripts
```

## Cara Pakai

```bash
git clone <repo-url>
cd <project-folder>
npm install
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:5000`

## Scripts

| Script              | Deskripsi                              |
| ------------------- | -------------------------------------- |
| `npm run dev`       | Jalankan server & client bersamaan     |
| `npm run dev:server`| Backend saja (nodemon)                 |
| `npm run dev:client`| Frontend saja (Vite)                   |
| `npm run build`     | Build frontend untuk production        |
| `npm start`         | Jalankan server production             |
| `npm run preview`   | Preview build Vite                     |
