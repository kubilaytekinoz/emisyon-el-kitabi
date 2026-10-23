# LABCORE — Emisyon & İmisyon Dijital Saha El Kitabı

Köprü ile **aynı alan adı altında ama tamamen ayrı uygulama**: LABCORE, `https://SUNUCU/rehber/` yolunda çalışır. Eski `https://SUNUCU/kopru` adresi korunur. Kullanıcı adı ve şifreyle giriş vardır; hesapları yalnızca admin oluşturur.

## Ayrı servis ve SQLite veritabanları

| | Köprü | LABCORE |
| --- | --- | --- |
| Uygulama klasörü | `/opt/kopru` | `/opt/emisyon-el-kitabi` |
| systemd servisi | `kopru.service` | `labcore.service` |
| Linux kullanıcısı | `kopru` | `labcore` |
| SQLite | `/opt/kopru/veritabani.db` | `/var/lib/labcore/labcore.sqlite` |
| Web yolu | `/kopru` | `/rehber/` |

LABCORE Node servisi sadece localhost `127.0.0.1:4100` dinler. Ortak Nginx HTTPS sunucusuna **mevcut /kopru kuralına dokunmadan** yeni /rehber yönlendirmesi eklenir. LABCORE systemd servisi `InaccessiblePaths=/opt/kopru` ile Köprü dosyalarından izole edilir.

## Hazır özellikler

- React + Express + SQLite WAL, PostgreSQL yok.
- Admin/personel kullanıcı adı ve şifre, bcrypt şifre özeti, httpOnly oturum çerezi, sunucu rol kontrolü.
- Admin: kullanıcı oluşturma, şifre değiştirme, hesap açma/kapatma, yöntem düzenleme.
- 15 yöntem taslağı ve beş aşamalı kontrol listeleri.
- Saha oturumu: tesis, numune noktası, notlar, kontroller, tamamlanma; metot sürümünü sabitleme.
- Temel audit kayıtları, yöntem sürüm çakışması kontrolü, mobil panel.
- SQLite güvenli çevrimiçi yedekleme.

## Kurulum

**[Mevcut Köprü sunucusuna /rehber kurulumu](docs/LINUX_KURULUM.md)**

**[Ayrı systemd servisi](deploy/labcore.service.example)**

**[Mevcut Nginx server bloğuna eklenen /rehber yönlendirmesi](deploy/nginx-labcore.conf.example)**

**Köprü uygulaması, servisi veya veritabanı değiştirilmez.** Yalnızca ortak Nginx yönlendirmesine /rehber kuralı eklenir; mevcut konfigürasyon önceden incelenip yedeklenmelidir. Uygulama henüz Linux'a kurulmuş değildir.

## Yerel geliştirme

Node.js 20+ gereklidir.

1. `npm install`
2. `.env.example` içeriğini `.env` dosyasına kopyala, ilk `ADMIN_USERNAME` ve en az 10 karakterli `ADMIN_PASSWORD` ayarla.
3. `npm run dev`
4. `http://localhost:5173/rehber/` adresinden gir.

Üretim için `APP_ORIGIN` yalnızca HTTPS + host olarak ayarlanmalıdır; /rehber içermez.

## Komutlar

- `npm run dev`: Vite frontend + API
- `npm run build`: /rehber/ kök URL'li React dağıtımı
- `npm start`: ayrı LABCORE servisi
- `npm test`: API ve SQLite iş akışı testleri
- `npm run backup`: SQLite çevrimiçi yedek

## Teknik sınırlar

Public GitHub repo yalnız kaynak kodunu barındırır; şifreler, kullanıcılar ve saha kayıtları repoya yüklenmez. **Metot kartları eğitim taslağıdır:** güncel laboratuvar SOP'si veya standardın yerine geçmez.

Canlıya çıkmadan önce HTTPS, Nginx /kopru /rehber davranışı, yedekleme, yetki kontrolü ve saha metotları doğrulanmalıdır.
