# LABCORE — Köprü Linux sunucusunda SQLite kurulumu

Mevcut Köprü (/opt/kopru) Flask uygulamasına, TECORA/PM10 işlerine ve Python sanal ortamına **dokunulmaz**. LABCORE kendi Node.js systemd servisi ve yerel SQLite veritabanıyla çalışır.

## Mimari

- Linux servis hesabı: kopru (sunucuda mevcut olduğundan emin olun).
- Kaynak kodu: /opt/emisyon-el-kitabi (GitHub repo).
- Veri: /var/lib/labcore/labcore.sqlite (yalnızca kopru kullanıcısı erişir).
- Servis: labcore.service (HTTP: 127.0.0.1:4100).
- Yayın: Nginx/reverse proxy + HTTPS, tercihen ayrı host adı.
- Yedekler: /var/backups/labcore (uygulama klasöründen ve GitHub'dan ayrı).
- PostgreSQL, ek veritabanı servisi veya DB kullanıcı hesabı **gerekmiyor**.

## 1. Mevcut sunucuyu kontrol et

Önce herhangi bir servisi değiştirmeden şu çıktıların üzerinden geçin:

    whoami
    cat /etc/os-release
    command -v node && node -v
    command -v npm && npm -v
    command -v git && git --version
    command -v nginx && nginx -v
    command -v systemctl
    id kopru
    ss -lntp

Node.js 20 veya üzeri gereklidir. better-sqlite3 yerel/native bağımlılıktır; Linux Node sürümü desteklenmeli, gerekirse derleme araçları kurulu olmalıdır. Mevcut Linux dağıtımına göre paketleri seçin.

## 2. Ayrı uygulama dizini ve kaynak kod

    sudo install -d -o kopru -g kopru -m 750 /opt/emisyon-el-kitabi
    sudo -u kopru git clone https://github.com/kubilaytekinoz/emisyon-el-kitabi.git /opt/emisyon-el-kitabi
    sudo -u kopru sh -c 'cd /opt/emisyon-el-kitabi && npm install --no-audit --no-fund && npm run build'

Mevcut /opt/kopru dizinine hiçbir dosya eklenmez.

## 3. SQLite dosya ve dizin izinleri

Systemd'deki StateDirectory=labcore ayarı /var/lib/labcore dizinini servis hesabı adına 0700 izinleriyle oluşturur. **İlk başlangıç öncesi ayrıca oluşturmak isterseniz:**

    sudo install -d -o kopru -g kopru -m 700 /var/lib/labcore

SQLite veritabanı ilk uygulama başlangıcında otomatik oluşturulur, tablolara 15 adet yöntem taslağı yüklenir. DB dosyası izni 0600 ayarlanır. WAL nedeniyle aynı dizinde -wal ve -shm dosyaları oluşması normaldir. Bunları servis açıkken silmeyin.

## 4. İlk yönetici ve gizli ayarlar

    sudo install -d -o root -g root -m 700 /etc/labcore
    sudo install -m 600 -o root -g root /dev/null /etc/labcore/labcore.env
    sudoedit /etc/labcore/labcore.env

Dosya örneği (gerçek şifreyi kendi sunucunuzdaki dosyada oluşturun):

    ADMIN_USERNAME=admin
    ADMIN_PASSWORD=UZUN_RASTGELE_GUCLU_ADMIN_SIFRESI
    APP_ORIGIN=https://elkitabi.ornek-domain.com

NODE_ENV, PORT ve DATABASE_PATH değerleri systemd servis dosyasında zaten tanımlı. İlk admin oluşunca ADMIN_PASSWORD değerini ortam dosyasından kaldırabilirsiniz (uygulama yalnızca kullanıcı tablosu boşken bu değeri okur). **Şifreyi, .env dosyasını ve DB dosyasını GitHub'a koymayın.**

## 5. LABCORE systemd servisi

Repodaki deploy/labcore.service.example dosyası kullanılabilir:

    sudo cp /opt/emisyon-el-kitabi/deploy/labcore.service.example /etc/systemd/system/labcore.service
    command -v node

Node /usr/bin/node dışında bir yerdeyse /etc/systemd/system/labcore.service içindeki ExecStart yolunu değiştirin.

    sudo systemctl daemon-reload
    sudo systemctl enable --now labcore
    sudo systemctl status labcore --no-pager
    sudo journalctl -u labcore -n 70 --no-pager
    curl -fsS http://127.0.0.1:4100/api/health

Beklenen örnek yanıt: {"ok":true,"db":"sqlite"}.

## 6. Nginx / HTTPS

deploy/nginx-labcore.conf.example yalnızca örnek yönlendirmedir. Mevcut Köprü yayınına müdahale etmeyin; ayrı bir hostname önerilir. Örnek config'deki server_name ve alan adlarını gerçek değerlere uyarlayın.

Üretimde **HTTPS zorunlu**: secure oturum çerezi ve doğru APP_ORIGIN için TLS sertifikasını yapılandırın. HTTP örneğini çıplak biçimde internete açık bırakmayın. Ardından:

    sudo nginx -t
    sudo systemctl reload nginx

Kullanıcılar siteye GitHub hesabıyla değil, yönetici tarafından verilen kullanıcı adı ve şifreyle girer.

## 7. Güvenli çevrimiçi SQLite yedeği

WAL açıkken sadece .sqlite dosyasını cp ile kopyalamak güvenilir değildir. Repoda SQLite online backup API'sini kullanan scripts/backup.mjs bulunmaktadır.

    sudo install -d -o kopru -g kopru -m 700 /var/backups/labcore
    sudo -u kopru env NODE_ENV=production DATABASE_PATH=/var/lib/labcore/labcore.sqlite BACKUP_DIRECTORY=/var/backups/labcore /usr/bin/node /opt/emisyon-el-kitabi/scripts/backup.mjs

Node yolu farklıysa yukarıdaki /usr/bin/node değerini değiştirin. İşlem tarih damgalı dosya üretir ve PRAGMA integrity_check ile bütünlüğünü kontrol eder.

Yedekler için ayrıca en az günlük zamanlayıcı, saklama süresi, sunucudan bağımsız yedekleme ve düzenli geri yükleme denemesi tanımlanmalıdır. **Yedekleri yalnızca aynı sunucuda bırakmak felakete karşı yeterli değildir.**

## 8. Güncelleme

    sudo -u kopru sh -c 'cd /opt/emisyon-el-kitabi && git pull --ff-only && npm install --no-audit --no-fund && npm run build'
    sudo systemctl restart labcore
    sudo systemctl status labcore --no-pager

Güncelleme öncesinde SQLite yedeğini alın. Kodla birlikte Node.js sürüm gereksinimleri ve veritabanı değişiklikleri de kontrol edilmelidir.

## 9. Önemli sınırlar

- Bu uygulama yalnızca tek makinede tutulan SQLite veritabanı içindir; DB dosyasını NFS/SMB gibi ağ sürücülerine koymayın.
- Çok yoğun eşzamanlı yazma yükünde PostgreSQL'e geçiş tekrar değerlendirilebilir.
- Akreditasyon, ölçüm süresi/debisi ve numune muhafaza şartları için mevcut metot kartları **taslaktır**; onaylı SOP gereklidir.
- GitHub Actions testleri kodu ve API iş akışlarını kontrol eder, kendi Linux sunucunuza otomatik kurulum yapmaz.
