# 🦉 OWLFX Executive Admin Hub (`admin.owlfx.my`)

[![Platform](https://img.shields.io/badge/Architecture-Headless%20Fintech%20Control%20Hub-blue?style=for-the-badge)](https://admin.owlfx.my)
[![Security Standard](https://img.shields.io/badge/Security-Zero--Trust%20Multi--Layer-emerald?style=for-the-badge)](#-senibina-keselamatan)
[![Engine](https://img.shields.io/badge/Engine-IqwanEngine-amber?style=for-the-badge)](#-kredit--hak-cipta)

> **Portal Operasi & Pengurusan Pangkalan Data Berpusat OWLFX.**  
> Dibangunkan khusus untuk kawalan operasi, analitik pedagang dwi-wilayah (Malaysia & Indonesia), pengesahan status kelayakan akaun Valetax, dan penyelenggaraan modul ekosistem secara berpusat.

---

## 🏛️ Gambaran Keseluruhan Sistem

`admin.owlfx.my` beroperasi sebagai pusat kawalan tertutup yang diasingkan sepenuhnya daripada portal awam (`owlfx.my`). Menggunakan pendekatan **Headless Operating Architecture**, panel ini membolehkan pihak pengurusan memantau volum dagangan, integrasi rebat, serta pendaftaran ahli tanpa mendedahkan pangkalan data teras kepada domain awam.

### Ciri-Ciri Utama:
- **Pengurusan Data Dwi-Wilayah:** Penapisan automatik bagi pendaftaran rantau Malaysia (MY) dan Indonesia (ID).
- **Pemantauan Status Kuantitatif:** Pengesanan status akaun secara automatik (*Active*, *Low Balance*, *Margin Call*, *VIP Verified*).
- **Pengasingan Subdomain Mutlak:** Perlindungan sesi dan kuki terpencil bagi mengelakkan kebocoran laluan dari domain umum.
- **Penyelarasan Data Masa Nyata:** Komunikasi data berpusat menggunakan lapisan perkhidmatan proksi pelayan (*Serverless Bridge*).

---

## 🔒 Senibina Keselamatan

Platform ini mengadaptasi piawaian **Zero-Trust Security** untuk memastikan integriti data pedagang sentiasa terpelihara:
