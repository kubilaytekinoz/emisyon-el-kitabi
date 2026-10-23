# LABCORE — Emisyon & İmisyon Dijital Saha El Kitabı

Kullanıcı adı + şifreyle giriş yapılan, **tek Linux sunucusunda SQLite ile çalışan** dijital numune alma rehberi. Açık üye olma veya self-servis şifre sıfırlama ekranı yoktur. Hesapları yalnızca admin oluşturur.

## Şu anki özellikler

- Güvenli admin/personel oturumu: bcrypt şifre özeti, sunucuda doğrulama, httpOnly oturum çerezi.
- Admin: kullanıcı oluşturma, etkinleştirme/pasifleştirme, şifre değiştirme.
- 15 yöntem taslağı: beş aşamalı kontrol listeleri, kritik uyarılar, metot düzenleme.
- Saha kayıtları: tesis, numune noktası, kontrol işaretleri, notlar ve tamamlanma durumu.
- Kayıtlar oluşturulduğu andaki yöntem sürümünün kopyasını saklar.
- İşlem günlüğü, yöntem sürüm artışı ve değişiklik çakışması kontrolü.
- Mobil uyumlu React dashboard.
- SQLite tek dosyalık kalıcı depolama + WAL, çevrimiçi yedekleme.

**Metot kartları eğitim taslağıdır. Onaylı SOP, standart ve akreditasyon talimatlarının yerine geçmez.**

## Mimari ve dizinler

- React + Vite: panel
- Express + Node.js: API ve giriş/rol kontrolü
- better-sqlite3: yerel SQLite veritabanı (PostgreSQL yok)
- Linux kod dizini: /opt/emisyon-el-kitabi
- Linux veritabanı: /var/lib/labcore/labcore.sqlite
- Linux servisi: labcore.service, sadece 127.0.0.1:4100 üzerinde
- HTTPS: mevcut reverse proxy/Nginx üzerinden, Köprü'den bağımsız.
- Giriş: admin'in oluşturduğu kullanıcı adı ve şifre.

## Kurulum

**Linux için tam rehber:** [docs/LINUX_KURULUM.md](docs/LINUX_KURULUM.md)

**Örnek servis:** [deploy/labcore.service.example](deploy/labcore.service.example)

**Nginx örneği:** [deploy/nginx-labcore.conf.example](deploy/nginx-labcore.conf.example)

Linux'ta PostgreSQL kurulumu gerekmiyor. Veritabanı ilk başlatmada kendiliğinden oluşturulur.

### Yerel geliştirme

Node.js 20+ gereklidir.

1. npm install
2. .env.example dosyasını .env olarak kopyala.
3. .env içine ADMIN_USERNAME, en az 10 karakterli ADMIN_PASSWORD yaz; DATABASE_PATH=./data/labcore.sqlite bırak.
4. npm run dev
5. http://localhost:5173 adresine gir.

İlk başlangıçta admin ve 15 yöntem taslağı oluşturulur.

## Ortam değişkenleri

| Değişken | Açıklama |
| --- | --- |
| DATABASE_PATH | SQLite dosya konumu; Linux'ta /var/lib/labcore/labcore.sqlite |
| ADMIN_USERNAME | İlk kurulumda admin kullanıcı adı |
| ADMIN_PASSWORD | İlk kurulumda admin şifresi; gerçek değer public repoya yazılmaz |
| APP_ORIGIN | Yayınlanan HTTPS adresi |
| PORT | API portu |
| NODE_ENV | production veya development |
| BACKUP_DIRECTORY | Yedekleme komutunda hedef klasör |

SQLite dosyası, -wal/-shm ek dosyaları, şifreler ve saha bilgileri **GitHub'a yüklenmez**. .gitignore bu dosya uzantılarını engeller.

## Komutlar

- npm run dev — Vite + API geliştirme
- npm run build — üretim React paketi
- npm start — tek Node servisiyle API + arayüz
- npm test — SQLite üzerinde API smoke test (giriş, rol, metot ve saha kayıtları)
- npm run backup — SQLite çevrimiçi yedek (izinlere ve DATABASE_PATH'e bağlı)

## Güvenlik ve sınırlar

İlk sürümde yöntem onay iş akışı, resmî e-imza ve LIMS entegrasyonu yoktur. Canlı saha verilerini kullanmadan önce HTTPS, yedekleme, kullanıcı yetkileri ve metot SOP doğrulaması tamamlanmalıdır.

**Repo public olabilir; uygulamaya giriş özel kalır.** GitHub Pages, güvenli giriş ve SQLite API'sini barındırmaz; uygulama kendi Linux sunucumuzda çalışacaktır.
