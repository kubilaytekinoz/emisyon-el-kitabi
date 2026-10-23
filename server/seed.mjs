// İlk kurulum örnek içerikleri. Tüm adımlar TASLAK olup SOP onayı gerektirir.
// Kaynak: laboratuvar kapsam ekranı; sayısal kriterler özellikle eklenmemiştir.
const catalog = [
  ['K-01','Yanma Gazları (SO₂, CO, O₂, NOx, CO₂)','TS ISO 12039:2020 · TS ISO 7935:2024 · EPA CTM-022','Emisyon','yüksek','Gaz hattında yoğuşma ve sıfır/span kayması', 'Analizör aralığı, gaz silindiri ve kayıt zamanları'],
  ['K-02','Baca Tozu Ölçümü','EPA 5 · EPA 17 · TS EN 13284-1 · TS ISO 12141','Emisyon','yüksek','İzokinetiklik, nokta seçimi, prob/filtre kayıpları','Filtre kimliği, tartım zinciri ve kaçak kontrolü'],
  ['K-03','İsilik Ölçümü','TS 9503:2014','Emisyon','orta','Örnek alma süresi ve filtre/kağıt bütünlüğü','Ölçüm noktası ve seri numarası eşleştirmesi'],
  ['K-04','VOC Örnekleme','TSE CEN/TS 13649:2015','Emisyon','yüksek','Adsorban kapasitesi, breakthrough ve saha körü','Tüp yönü, debi, süre, taşıma ve sıcaklık'],
  ['K-05','VOC Analizi İçin Numune Teslimi','TSE CEN/TS 13649:2015','Laboratuvar','yüksek','Çapraz bulaşma ve analit kararlılığı','Tüp kimliği, laboratuvar kabulü, taşıma zinciri'],
  ['K-06','Florür Örnekleme','EPA Method 13A','Emisyon','yüksek','Toplam florür kapsamı; yalnız HF varsayılmamalı','Absorpsiyon düzeneği, sızdırmazlık ve çözelti'],
  ['K-07','Florür Analizi İçin Numune Teslimi','EPA Method 13A','Laboratuvar','orta','Şişe/reaktif uygunluğu ve kontaminasyon','Numune kodu, uygun muhafaza ve körler'],
  ['K-08','HCl Örnekleme ve Analizi','TS EN 1911:2011','Emisyon','yüksek','Çözünebilir gaz kayıpları, hat koşulları ve yoğuşma','Absorpsiyon çözeltileri ve gaz hacmi kayıtları'],
  ['K-09','Baca Gazı Hızı','TS ISO 10780:1999','Fiziksel','orta','Pitot yönlendirmesi, profil ve basınç okuması','Travers noktaları, sıcaklık ve cihaz kontrolü'],
  ['K-10','Baca Gazı Nem / Sıcaklık','Onaylı işletme içi yöntem — doğrulanacak','Fiziksel','orta','Yoğuşma, termometre konumu ve temsil edicilik','Kalibrasyon, hesap ve proses koşulları'],
  ['K-11','Formaldehit Örnekleme','EPA Method 323','Emisyon','yüksek','Metodun uygulanabilir kaynak tipi önceden doğrulanmalı','Uygun reaktif/absorpsiyon ve taşıma'],
  ['K-12','H₂SO₄, SO₃ ve SO₂','EPA Method 8','Emisyon','yüksek','Asit sisi ile gaz fazının metot gereği ayrılması','Buharlaşma, absorban ve körler'],
  ['K-13','Çevre Havası PM10','TS EN 12341:2023 · 40 CFR Part 50','İmisyon','yüksek','Uygun giriş başlığı, debi ve filtre şartlandırma','Meteoroloji, lokasyon, saha körü, süre'],
  ['K-14','Çöken Toz','TS 2342:1976 · Ek-1 / Ek-2','İmisyon','orta','Toplayıcı konumu, dış etkenler ve maruziyet süresi','Kap kimliği, yağış bilgisi ve taşıma'],
  ['K-15','Toplam Organik Karbon (FID)','TS EN 12619:2013','Emisyon','yüksek','FID sıfır/span, gaz akışı, alev kararlılığı','Kalibrasyon gazları, ölçüm verisi ve normalizasyon']
];
function phases(title, focus, record) {
  return [
    { id:'p1',title:'İş öncesi doğrulama',items:[
      'İş emri, hedef parametre, matris ve numune noktası doğrulandı.',
      'Güncel ve onaylı SOP ile laboratuvar yetki/kapsam bilgisi kontrol edildi.',
      'Saha riskleri, KKD ve çalışma izinleri değerlendirildi.' ]},
    { id:'p2',title:'Ekipman hazırlığı',items:[
      'Yönteme uygun ekipman, sarf, numune kabı ve kontrol listesi hazır.',
      'Kalibrasyon / doğrulama kayıtları ve geçerlilik tarihleri kontrol edildi.',
      'Kritik odak: ' + focus + '.' ]},
    { id:'p3',title:'Saha kurulumu',items:[
      'Numune noktası ve proses koşulları fotoğraf/not ile kaydedildi.',
      'Hat, bağlantı ve yöntem gereği kaçak / akış kontrolleri tamamlandı.',
      'Başlangıç koşulları ve cihaz kimliği kayıt altına alındı.' ]},
    { id:'p4',title:'Numune alma / ölçüm',items:[
      'Ölçüm parametreleri onaylı SOP limitleriyle karşılaştırıldı.',
      'Sapma, duruş, müdahale ve belirsizlik kaynağı kaydedildi.',
      'Kritik odak ölçüm boyunca izlendi: ' + focus + '.' ]},
    { id:'p5',title:'Kapatma ve teslim',items:[
      'Numune etiketleri, alan tutanağı ve teslim zinciri tam.',
      'Son cihaz kontrolü ve temizleme/dekontaminasyon SOP uyarınca yapıldı.',
      'Mutlaka kaydedilecek bilgiler: ' + record + '.' ]}
  ];
}
export const defaultMethods = catalog.map(([id,title,standard,category,risk,focus,record]) => ({
  id,title,standard,category,risk,
  summary: title + ' için saha uygulama kartı. Bu içerik eğitsel taslaktır; onaylı yöntem/SOP yerine geçmez.',
  critical: [focus, 'Sayısal debi, süre, muhafaza ve kabul sınırları onaylı SOP üzerinden doğrulanmalıdır.'],
  stop: ['Sahada güvenlik şartı sağlanmıyorsa işe başlanmaz.', 'Kritik yöntem koşulları sağlanmadıysa sapma kaydı açılır ve teknik sorumluya bildirilir.'],
  phases: phases(title,focus,record)
}));
