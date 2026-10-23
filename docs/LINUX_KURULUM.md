# LABCORE - Kendi Linux Sunucumuzda Kurulum

Bu dokuman mevcut Kopru uygulamasina dokunmadan LABCORE'u ayni makinede **ayri bir servis** olarak calistirmak icindir.

## Bildigimiz mevcut durum

- Mevcut Kopru dizini: /opt/kopru (Flask + TECORA/PM10 akislarini barindirir)
- Islem kullanicisi: kopru
- Yeni LABCORE dizini: /opt/emisyon-el-kitabi
- Yeni Node servisi: labcore.service
- Yeni dinleme adresi: 127.0.0.1:4100
- Yeni LABCORE veri deposu: ayri PostgreSQL veritabani

**Kopru klasorunu, servis ayarlarini, Python sanal ortamını veya TECORA verilerini degistirmeyin.**

## 0. Sunucuda once kontrol

Kopru kullanicisi hesabina girdikten sonra:

    whoami
    cat /etc/os-release
    command -v node && node -v
    command -v npm && npm -v
    command -v git && git --version
    command -v psql && psql --version
    command -v nginx && nginx -v
    command -v systemctl
    ss -lntp

Bu komutlar envanter icindir. Kurulu olmayan bilesenleri isletim sisteminin paket yoneticisine gore kurun. Node.js 20+ gereklidir. Nginx mevcut degilse veya baska reverse proxy kullaniliyorsa ornek config'i kullanmadan once mevcut yapıya uyarlayin.

## 1. Uygulama dizini

Dizini root yetkisiyle ayri olusturun ve sadece kopru hesabina verin:

    sudo install -d -o kopru -g kopru -m 750 /opt/emisyon-el-kitabi
    sudo -u kopru git clone https://github.com/kubilaytekinoz/emisyon-el-kitabi.git /opt/emisyon-el-kitabi
    cd /opt/emisyon-el-kitabi
    npm install --no-audit --no-fund
    npm run build

Bu asamada gelistirme ortami ve veritabani kurulumu gerekmez; sadece React arayuzu derlenir.

## 2. PostgreSQL veritabani

Zaten kurulu ve uyumlu PostgreSQL varsa yeni ornek kurmaya gerek yok. **Kopru'nun var olan veri tabanlarini kullanmayin.**

Isterseniz mevcut PostgreSQL superuser'i ile asagidaki gibi LABCORE'a ozel rol ve DB olusturabilirsiniz:

    sudo -u postgres psql -c "CREATE ROLE labcore_app LOGIN;"
    sudo -u postgres psql -c "CREATE DATABASE labcore OWNER labcore_app;"
    sudo -u postgres psql

psql icindeyken:

    \password labcore_app
    \q

DATABASE_URL degerindeki parolanin URL icin ozel karakterleri varsa yuzde kodlamasi yapilmalidir. Izinleri sadece LABCORE veritabanina sinirlayin.

## 3. Sunucu sirlarini tanimlama

Ortam degiskenleri **GitHub'a konulmaz**. Root erisimli bir dosyada tutulur:

    sudo install -d -m 700 -o root -g root /etc/labcore
    sudo install -m 600 -o root -g root /dev/null /etc/labcore/labcore.env
    sudoedit /etc/labcore/labcore.env

Dosya icerigi sablonu:

    DATABASE_URL=postgresql://labcore_app:PAROLAYI_GIRIN@127.0.0.1:5432/labcore
    ADMIN_USERNAME=admin
    ADMIN_PASSWORD=EN_AZ_10_KARAKTERLIK_GUCLU_BIR_SIFRE
    APP_ORIGIN=https://elkitabi.example.com

APP_ORIGIN degerini **kendi gercek HTTPS adresiniz** olarak ayarlayin. Admin ilk baslatmada olusur; ardindan ADMIN_PASSWORD degerini ortamdan kaldirabilirsiniz.

## 4. systemd servisi

Servis ornegi: deploy/labcore.service.example

    sudo cp /opt/emisyon-el-kitabi/deploy/labcore.service.example /etc/systemd/system/labcore.service
    command -v node

Node yolu /usr/bin/node degilse servis dosyasindaki ExecStart degerini guncelleyin.

    sudo systemctl daemon-reload
    sudo systemctl enable --now labcore
    sudo systemctl status labcore --no-pager
    sudo journalctl -u labcore -n 80 --no-pager
    curl -fsS http://127.0.0.1:4100/api/health

Servis **yalnizca localhost** dinler. Dış erişim icin mevcut reverse proxy uzerinden HTTPS yonlendirmesi yapilir.

## 5. Nginx / HTTPS

Eger Kopru'nun onunde Nginx varsa, mevcut Kopru konfigürasyonuna dokunmadan **ayri bir server_name** kullanin.

Ornek dosya: deploy/nginx-labcore.conf.example

Buradaki elkitabi.example.com bir **ornek alan adidir**. Kendi DNS adinizi kullanin. Ornek konfigürasyon yalnızca HTTP kurulum asamasini gosterir. Erişime açmadan once sertifika ve HTTPS yonlendirmesini tamamlayin. Sonra:

    sudo nginx -t
    sudo systemctl reload nginx

Eger mevcut Kopru alt yolunu kullanmak istiyorsak once proxy yapisini birlikte gozden gecirmeliyiz: React asset yolları ve /api adresleri ayrica duzenlenmelidir. Bu nedenle ilk asamada **ayri bir subdomain veya hostname** daha guvenlidir.

## 6. İlk giriş

HTTPS site acildiktan sonra ilk admin kullanicisi ile girin. Panelden personel ekleyin, sifrelerini guvenli kanaldan iletin, sonra gerekli metotlari duzenleyin.

Islevler: kullanici adi + sifre; kayit olma ve otomatik sifre sifirlama yok.

Sadece bir yönetici hesabiniz olabilir; sistem son etkin adminin devre disi birakilmasini engeller. Admin yeni kullanici sifresi belirleyebilir.

## 7. Güncelleme

Yeni surumde uygulama dizininde:

    cd /opt/emisyon-el-kitabi
    git pull --ff-only
    npm install --no-audit --no-fund
    npm run build
    sudo systemctl restart labcore
    sudo systemctl status labcore --no-pager

Canlı ortamda veritabanı yedegini guncelleme oncesi alin. Paket versiyonlarini sabitlemek icin lockfile hazirlandiktan sonra npm ci tercih edin.

## Guvenlik ve kalite notlari

- Public repo, uygulama kaynak kodunu herkesin okuyabilmesi demektir; gerçek şifre veya firma/saha kaydi burada tutulmaz.
- Admin paneli public olsa bile API izinlerini sunucu zorunlu tutar.
- Saha bilgisi sisteme girilmeden once HTTPS ve veri tabani yedekleme hazir olmali.
- Kod otomatik derleme kontrolunu gecse bile uctan uca sunucu/veritabani testi icin uygulama deploy edilmelidir.
- V0.1 yöntem içerikleri **taslaktır**; teknik sorumlu SOP dogrulamasi olmadan resmi uygulama talimati degildir.
