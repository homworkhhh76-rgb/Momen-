const CACHE = 'oskar-r27-compact-fixed-ui-momen-firebase';
const ASSETS=["index.html", "firebase-config.js", "firebase.js", "icon.svg", "manifest.webmanifest", "oskar-core-fix.js", "oskar-mobile-app-polish.js", "qr.mp3", "sw.js", "إدارة-الحسابات.html", "إضافة-المصاريف.html", "إضافة-صنف.html", "إضافة-مبيعات.html", "إضافة-مشتريات.html", "إعدادات-الباركود.html", "استيراد-العملاء-والموردين.html", "استيراد-بيانات-الأصناف.html", "استيراد-بيانات-المبيعات.html", "استيراد-كميات-افتتاحية.html", "الأجور.html", "الأكثر-مبيعا.html", "الإعدادات.html", "الديون.html", "الشحن-والتوصيل.html", "العملاء.html", "الفواتير.html", "الكاشير.html", "المخزون-التالف.html", "الموردين.html", "الموظفين.html", "تحديث-الأسعار.html", "تحويل-مالي.html", "تقرير-الأرباح.html", "تقرير-الحسابات.html", "تقرير-الديون.html", "تقرير-العملاء-والموردين.html", "تقرير-المبيعات-مفصل.html", "تقرير-المخزون.html", "تقرير-المشتريات.html", "تقرير-المصاريف.html", "تقرير-مناوبة-الموظفين.html", "حركات-الأصناف.html", "خصومات-ترويجية.html", "سجل-الحسابات.html", "سجل-الكاشير.html", "سجل-المشتريات.html", "سجل-نشاطات-الموظفين.html", "شروحات.html", "شكل-الفاتورة.html", "ضمانات-الأصناف.html", "طابعات-الإيصالات.html", "طباعة-الملصقات.html", "عروض-الأسعار.html", "فئات-المصاريف.html", "فروع-مخازن.html", "قائمة-المصاريف.html", "كاميرا-الكاشير.html", "كل-الأصناف.html", "كل-المبيعات.html", "كل-المشتريات.html", "لوحة-المتابعة.html", "ماركات-الأصناف.html", "متغيرات-الأصناف.html", "مجموعات-الأسعار.html", "مجموعات-الأصناف.html", "مجموعات-العملاء.html", "مرجع-المبيعات.html", "مرجع-المشتريات.html", "مسودات-البيع.html", "مطعم-الحجوزات.html", "مطعم-الطاولات.html", "مطعم-المطبخ.html", "مطعم-المنيو-الرقمي.html", "مطعم-الوصفات-والتكلفة.html", "مطعم-تحليلات-الأرباح.html", "مطعم-كاشير-المطعم.html", "مطعم-مخزون-المطعم.html", "معدلات-الضرائب.html", "نقل-مخزني.html", "وحدات-الأصناف.html"];
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await Promise.allSettled(ASSETS.map(url=>cache.add(new Request(url,{cache:'reload'}))));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
function sameOrigin(req){try{return new URL(req.url).origin===self.location.origin}catch(e){return false}}
function shouldNetworkOnly(req){
  try{const u=new URL(req.url); return req.method!=='GET'||u.hostname.includes('firebaseio.com')||u.hostname.includes('googleapis.com')||u.hostname.includes('gstatic.com')||u.pathname.endsWith('/sw.js')||u.pathname.endsWith('.json');}catch(e){return true}
}
async function putCache(req,res){try{if(res&&res.ok&&sameOrigin(req)){const c=await caches.open(CACHE); await c.put(req,res.clone());}}catch(e){}}
async function cacheFirst(req){
  const cached=await caches.match(req,{ignoreSearch:true});
  if(cached){ fetch(req).then(res=>putCache(req,res)).catch(()=>{}); return cached; }
  try{const res=await fetch(req); await putCache(req,res); return res;}
  catch(e){return caches.match('index.html') || Response.error();}
}
async function navigation(req){
  const u=new URL(req.url);
  const path=u.pathname.split('/').pop() || 'index.html';
  try{const res=await fetch(req,{cache:'reload'}); await putCache(req,res); return res;}
  catch(e){
    const direct=await caches.match(path,{ignoreSearch:true}) || await caches.match(req,{ignoreSearch:true});
    return direct || caches.match('index.html') || Response.error();
  }
}
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(shouldNetworkOnly(req)){ event.respondWith(fetch(req).catch(()=>caches.match(req))); return; }
  if(req.mode==='navigate'){ event.respondWith(navigation(req)); return; }
  event.respondWith(cacheFirst(req));
});

// R19: native visual restoration, stable invoices, restored purchase/restaurant links

// R19: cache refresh for native merged build

// R23 clean

// R25 integrated modern UI, professional sync/invoice icons, accounting English, network-first HTML

// R27 compact fix: no inline page bloat, one-field rows, draggable closable modals, customer debt buttons fixed.
