# LABCORE — Emisyon & İmisyon Dijital Saha El Kitabı

Kullanıcı adı ve şifreyle girilen, yöneticinin kullanıcıları ve metotları düzenlediği, PostgreSQL destekli web uygulaması.

**Kullanım amacı:** Saha personeline yöntem adımlarını, kritik noktaları ve saha kontrol oturumlarını göstermek. Taslak içerikler **onaylı SOP, güncel standart veya akreditasyon kaydı yerine geçmez**.

## Özellikler

- **Açık kayıt olma ve şifremi unuttum ekranı yok.** Yalnızca admin personel hesabı oluşturabilir.
- Bcrypt ile şifre özeti, sunucu doğrulaması, 14 günlük HTTP-only oturum çerezi.
- Yönetici: personel ekleme, şifre değiştirme, hesabı kapatma/açma.
- 15 yöntem taslağı, 5 aşamalı kontrol listeleri, kritik/durdurma uyarıları.
- Yönetici: yöntem başlığı, standardı, uyarıları ve saha adımlarını panelden düzenleme.
- Personel: tesise/metoda göre saha kaydı başlatma, kontrol işaretleme, not ekleme.
- Saha kaydı oluşturulurken **metodun mevcut sürümünün kopyası** saklanır.
- Rol yetkileri sunucuda zorunlu tutulur. Audit olayları veritabanına kaydedilir.
- Mobil uyumlu dashboard, metot arama ve aşama bazlı rehber.

## Teknoloji

Vite + React + Express (Node.js) + PostgreSQL + bcryptjs. Tek Node servisi hem API'yi hem derlenmiş paneli sunar. Kaynak kodunu public tutabilirsiniz; veriler ve sırlar sunucudadır.

## Yerel kurulum

Node.js 20+, npm, PostgreSQL gerekir.

1. Projeyi indir ve terminalde npm install çalıştır.
2. .env.example dosyasını .env olarak kopyala.
3. PostgreSQL'de labcore adlı boş veritabanı oluştur.
4. .env dosyasına DATABASE_URL, ADMIN_USERNAME ve **en az 10 karakterli** ADMIN_PASSWORD gir.
5. npm run dev komutunu çalıştır.
6. http://localhost:5173 adresini aç.

İlk açılışta tablolar hazırlanır; **henüz hiç kullanıcı yoksa** ilk admin oluşturulur ve 15 taslak yöntem yüklenir. Admin oluşturulduktan sonra ADMIN_PASSWORD ortam değişkenini kaldırabilirsiniz.

### Ortam değişkenleri

| Değişken | Anlam |
| --- | --- |
| DATABASE_URL | PostgreSQL bağlantı URL'i, sunucuda gizli kalmalı |
| ADMIN_USERNAME | İlk kurulumda oluşturulacak kullanıcı adı |
| ADMIN_PASSWORD | İlk kurulumda oluşturulacak yönetici şifresi; en az 10 karakter |
| APP_ORIGIN | Uygulamanın gerçek URL'i, örneğin https://site.example |
| PORT | Sunucu portu; yerelde varsayılan 4000 |
| NODE_ENV | Yayında production olmalı |

Gerçek şifreleri, .env dosyasını, müşteri bilgilerini veya veritabanı içeriğini GitHub'a yüklemeyin.

## Yayınlama: kendi Linux sunucumuz

**Hedef ortam:** kopru Linux kullanıcısı ile çalışan, mevcut /opt/kopru Flask uygulamasından bağımsız /opt/emisyon-el-kitabi dizini ve labcore.service. PostgreSQL ayrı veritabanında; Nginx veya mevcut reverse proxy üzerinden HTTPS.

**Adım adım kurulum rehberi:** docs/LINUX_KURULUM.md. **Örnek systemd servisi:** deploy/labcore.service.example. **Nginx örneği:** deploy/nginx-labcore.conf.example.

**GitHub Pages tek başına bu uygulamayı çalıştıramaz.** Gerçek giriş, kullanıcı yönetimi ve saha verileri için Node sunucusu ve PostgreSQL gerekir.

LABCORE'u mevcut Linux sunucumuzda ayrı bir systemd servisiyle yayınlayacağız. Köprü uygulamasının koduna veya çalışma dizinine müdahale edilmeyecek. Başlamadan önce sunucunun dağıtımı, Node.js ve PostgreSQL varlığı kontrol edilmelidir.

## Teknik sınırlar

- 15 yöntem kartı **ön taslaktır**. Gerçek debi, süre, absorban/reaktif, cihaz sınırları, saha kabul kriterleri, numune muhafazası ve taşıma süreleri **onaylı laboratuvar SOP'lerine göre doğrulanmalıdır**.
- Bu sürüm bir LIMS, resmî elektronik imza veya ISO/IEC 17025'e tam uygunluk iddiası taşımaz.
- Kontrol listelerinde tüm adımlar işaretlenmeden oturum tamamlanamaz; uygunsuzluklar notlara yazılıp teknik sorumluya iletilmelidir.
- Büyük kullanıcı yükü için kalıcı rate-limit deposu, merkezi loglama, kapsamlı revizyon/onay iş akışı sonraki fazdır.
- **Public repo, kaynak kodunun herkesçe görüntülenebileceği anlamına gelir.** Arkadaşların uygulamaya girebilmesi için reponun public olması gerekmiyor.

## Komutlar

- npm run dev: React + API geliştirme sunucuları
- npm run build: üretim arayüzünü derler
- npm start: API ve derlenmiş paneli sunar
