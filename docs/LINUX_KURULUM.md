# LABCORE — Aynı hostta /kopru + /rehber kurulumu

**Temel kural: Köprü'ye dokunmuyoruz.** Köprü'nün Flask dosyaları, Gunicorn süreçleri, servis ayarı, SQLite veritabanı, Python ortamı ve var olan Nginx `/kopru` location satırları değiştirilmeyecek.

> LABCORE'un **aynı hostun `/rehber/` yolunda** açılması için, Köprü'nün de kullanıldığı Nginx HTTPS `server` bloğuna yalnızca YENİ `/rehber` location satırları eklenmelidir. Bu web sunucusu yapılandırma değişikliğidir; Köprü uygulamasında değişiklik değildir. Önce mevcut yapılandırmayı görmeden canlı Nginx dosyasına müdahale etmeyin.

## Nihai mimari

| Bileşen | Mevcut Köprü | Yeni LABCORE |
| --- | --- | --- |
| Web yolu | https://SUNUCU/kopru | https://SUNUCU/rehber/ |
| Uygulama | /opt/kopru | /opt/emisyon-el-kitabi |
| Systemd | kopru.service | labcore.service |
| Linux çalışma kullanıcısı | kopru | labcore (ayrı sistem hesabı) |
| SQLite | /opt/kopru/veritabani.db | /var/lib/labcore/labcore.sqlite |
| Backend | Flask / Gunicorn | Node.js / Express |
| Port | mevcut yapılandırma | 127.0.0.1:4100 |
| Kullanıcılar | mevcut Köprü kullanıcıları | LABCORE admin/personel |
| Yedekler | mevcut politika | /var/backups/labcore |

LABCORE systemd servisi **InaccessiblePaths=/opt/kopru** ve **ProtectSystem=strict** kısıtlarıyla çalışır. Böylece LABCORE servisi Köprü dosyalarına erişemez. İki veritabanı arasında hiçbir yazılım bağlantısı yoktur.

## 1 — Mevcut sistemi değiştirmeden incele

Önce çıktıları kontrol et:

    whoami
    cat /etc/os-release
    command -v node && node -v
    command -v npm && npm -v
    command -v git && git --version
    command -v nginx && nginx -v
    systemctl is-active kopru.service
    sudo nginx -t
    sudo ss -lntp

Nginx'in **hangi HTTPS server bloğunda** `/kopru` yolunu sunduğunu ve mevcut rewrite/proxy kuralını önce doğrula. `sudo nginx -T` çıktısında bu bilgiyi bulabilirsin. Gizli bilgiler varsa paylaşmadan önce maskele. Var olan nginx dosyalarının kendisini ve varsa sertifika yolunu bilinçsizce değiştirme.

Köprü için başlangıç HTTP durumunu ayrıca kaydet (örnek host adıyla):

    curl -sS -o /dev/null -w '%{http_code}\n' https://SUNUCU/kopru

HTTP 200 veya yönlendirme (301/302/308) beklenebilir; gerçek davranışı kaydet ve yayın sonrası aynı davranışı kontrol et.

## 2 — Ayrı servis hesabı ve klasörler

Köprü hesabını kullanmak yerine yeni kısıtlı LABCORE hesabı oluştur. Komutlar sudo yetkisi gerektirir. `/usr/sbin/nologin` konumu dağıtıma göre değişebilir.

    id labcore || sudo useradd --system --home-dir /var/lib/labcore --shell /usr/sbin/nologin labcore
    sudo install -d -o labcore -g labcore -m 700 /var/lib/labcore
    sudo install -d -o labcore -g labcore -m 750 /opt/emisyon-el-kitabi
    sudo -u labcore -H git clone https://github.com/kubilaytekinoz/emisyon-el-kitabi.git /opt/emisyon-el-kitabi
    sudo -u labcore -H sh -c 'cd /opt/emisyon-el-kitabi && npm install --no-audit --no-fund && npm run build'

Node.js 20+ gereklidir. `better-sqlite3` native modül olduğu için sunucunun Node sürümü ve gerektiğinde derleme araçları uyumlu olmalı.

**Bu adımda /opt/kopru, kopru.service ve Köprü DB dosyasına müdahale edilmez.**

## 3 — Gizli ayarlar

    sudo install -d -o root -g root -m 700 /etc/labcore
    sudo install -m 600 -o root -g root /dev/null /etc/labcore/labcore.env
    sudoedit /etc/labcore/labcore.env

Dosya örneği:

    ADMIN_USERNAME=admin
    ADMIN_PASSWORD=KENDINIZE_OZEL_UZUN_RASTGELE_SIFRE
    APP_ORIGIN=https://SUNUCU

**APP_ORIGIN içinde `/rehber` OLMAMALI:** origin yalnızca https + host (+ varsa port) bilgisidir. NODE_ENV, PORT ve DATABASE_PATH systemd dosyasında tanımlıdır. İlk admin oluşturulduktan sonra ADMIN_PASSWORD değişkeni ortam dosyasından kaldırılabilir.

Gerçek şifre veya bu dosya GitHub'a gönderilmez.

## 4 — Ayrı LABCORE servisi

Repodaki [deploy/labcore.service.example](../deploy/labcore.service.example) dosyasını kullan:

    sudo cp /opt/emisyon-el-kitabi/deploy/labcore.service.example /etc/systemd/system/labcore.service
    command -v node

Node yolu `/usr/bin/node` değilse servis dosyasında sadece ExecStart yolunu LABCORE için düzelt.

    sudo systemctl daemon-reload
    sudo systemctl enable --now labcore
    sudo systemctl status labcore --no-pager
    sudo journalctl -u labcore -n 70 --no-pager
    curl -fsS http://127.0.0.1:4100/rehber/api/health

Beklenen JSON: `{"ok":true,"db":"sqlite"}`

Çalışma veritabanı `/var/lib/labcore/labcore.sqlite` ilk başlangıçta oluşur. SQLite WAL nedeniyle `-wal` ve `-shm` ek dosyaları olabilir; bunları servis çalışırken silme.

## 5 — Mevcut HTTPS Nginx bloğuna sadece /rehber kuralı ekle

1. Mevcut konfigürasyonun hangi dosyada olduğunu belirle.
2. **Bu dosyanın yedeğini al.**
3. Aynı HTTPS server bloğuna, Köprü kuralını değiştirmeden [deploy/nginx-labcore.conf.example](../deploy/nginx-labcore.conf.example) içindeki yalnızca iki yeni location satırını ekle.
4. `proxy_pass http://127.0.0.1:4100;` satırında sonda `/` OLMAMALI. Yeni API `/rehber/api` yolunu bekler.
5. Önce `sudo nginx -t`; yalnızca başarılıysa `sudo systemctl reload nginx`.
6. Hem eski `https://SUNUCU/kopru` hem yeni `https://SUNUCU/rehber/` için HTTP durumunu ve sayfa işlevini doğrula.

Bu projedeki Nginx örneği **tam bir server bloğu değildir**. Ayrı host tanımlamaz; mevcut hostun içine sadece /rehber yollarını ekler. Gerçek Nginx mimarisini görmeden otomatik değişiklik yapma.

## 6 — Rollback

Yeni konfigürasyonla bir sorun görülürse:

1. Kaydettiğin Nginx yedeğinden eski duruma dön.
2. `sudo nginx -t` başarılı olunca `sudo systemctl reload nginx` ile eski yönlendirmeyi geri al.
3. Gerekirse **yalnız LABCORE** servisini kapat: `sudo systemctl stop labcore`.
4. Köprü servisini, dosyalarını ve veritabanını elleme.

## 7 — SQLite çevrimiçi yedekleme

SQLite WAL aktif olduğundan sadece ana .sqlite dosyasını `cp` ile almak eksik yedeğe yol açabilir. scripts/backup.mjs çevrimiçi yedekleme API'sini kullanır.

    sudo install -d -o labcore -g labcore -m 700 /var/backups/labcore
    sudo -u labcore -H env NODE_ENV=production DATABASE_PATH=/var/lib/labcore/labcore.sqlite BACKUP_DIRECTORY=/var/backups/labcore /usr/bin/node /opt/emisyon-el-kitabi/scripts/backup.mjs

Node yolunu sunucuda doğrula. Yedek ayrıca bütünlük kontrolünden geçirilir. Günlük zamanlama, uzak kopya ve periyodik geri yükleme testleri önerilir.

## 8 — Güncelleme

    sudo -u labcore -H sh -c 'cd /opt/emisyon-el-kitabi && git pull --ff-only && npm install --no-audit --no-fund && npm run build'
    sudo systemctl restart labcore

**Köprü ile paylaşılan kod, Python ortamı, veritabanı veya servis yoktur.** Veri tabanını NFS/SMB ağına taşımayın.

## Test sınırları

GitHub Actions testleri /rehber API yönlendirmesini, kullanıcı yönetimini ve SQLite verilerini test eder. Gerçek Nginx/Köprü uyumluluğunu doğrulamak için **canlı sunucunun Nginx yapılandırmasını** görmek ve iki adresi test etmek zorunludur. Gerçek metot kartlarının sahada kullanılması için teknik sorumlu SOP onayı gerekir.
