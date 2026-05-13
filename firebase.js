// firebase.js - ملف فايربيز الوحيد في المشروع
// إصلاح جذري: حفظ محلي أولاً، ثم مزامنة سحابية آمنة للحفظ والتعديل والحذف بدون تغيير تصميم الصفحات.
window.CASHIER_FIREBASE_CONFIG = window.CASHIER_FIREBASE_CONFIG || {
  firebaseConfig: {
    apiKey: "AIzaSyBmFvdRJX64UEWw11eu9buhPc6kVvxVx_U",
    authDomain: "momen-1d40d.firebaseapp.com",
    databaseURL: "https://momen-1d40d-default-rtdb.firebaseio.com",
    projectId: "momen-1d40d",
    storageBucket: "momen-1d40d.firebasestorage.app",
    messagingSenderId: "978169521529",
    appId: "1:978169521529:web:37d8260872e0ee3561fba8",
    measurementId: "G-YGWN79ZB3J"
  },

  firebaseRoot: "cashier_units_pro_momen_1d40d_885766842",

  fallbackRoots: [
    "cashier_units_pro_momen_1d40d_885766842"
  ]
};

window.OSKAR_FIREBASE_CONFIG_READY = true;
window.OSKAR_FIREBASE_LOGIN_KEY = window.CASHIER_FIREBASE_CONFIG.firebaseRoot;
window.OSKAR_FIREBASE_CONFIG = window.CASHIER_FIREBASE_CONFIG.firebaseConfig;

const CASHIER_FIREBASE_CONFIG = window.CASHIER_FIREBASE_CONFIG;
const firebaseConfig = CASHIER_FIREBASE_CONFIG.firebaseConfig;
const FIREBASE_ROOT = String(CASHIER_FIREBASE_CONFIG.firebaseRoot || "cashier_units_pro_momen_1d40d_885766842").trim();
const FIREBASE_FALLBACK_ROOTS = Array.isArray(CASHIER_FIREBASE_CONFIG.fallbackRoots) ? CASHIER_FIREBASE_CONFIG.fallbackRoots : [FIREBASE_ROOT];

(function(){
  'use strict';
  const APP_KEY='supermarket_pos_ar_v1';
  const ROOT_PATH='';
  const DEFAULT_COMPANY=FIREBASE_ROOT;
  const LEGACY_COMPANY_KEYS=new Set(FIREBASE_FALLBACK_ROOTS);
  const DELETE_KEYS=['__deleted','_deletedIds'];
  const META_KEYS=new Set(['lastSyncAt','lastLocalUpdate','lastCloudPull','__deleted','_deletedIds','_syncMeta']);
  const ITEM_META=new Set(['_updatedAt','_createdAt','_deleted','deletedAt','_syncStamp']);
  const state={snapshot:null,syncTimer:null,pullTimer:null,installTimer:null,applyingRemote:false,lastLocalSaveAt:0,lastUserEditAt:0,lastError:null,started:false,deferredRenderTimer:null};

  function now(){return new Date().toISOString()}
  function isObj(v){return !!v && typeof v==='object' && !Array.isArray(v)}
  function clone(v){try{return JSON.parse(JSON.stringify(v||{}))}catch(e){return {}}}
  function readLocal(){try{return JSON.parse(localStorage.getItem(APP_KEY)||'{}')||{}}catch(e){return {}}}
  function writeLocal(db,opts={}){localStorage.setItem(APP_KEY,JSON.stringify(db||{})); if(opts.snapshot!==false) state.snapshot=clone(db||{});}
  function clean(v){const s=String(v||DEFAULT_COMPANY).trim().replace(/[^a-zA-Z0-9_-]/g,'_'); return (!s||s!==DEFAULT_COMPANY)?DEFAULT_COMPANY:s}
  function currentCompanyKey(fallback){
    const db=readLocal(); let key=fallback || db?.settings?.companyKey;
    try{const u=JSON.parse(localStorage.getItem('currentUser')||'{}'); key=key || u.companyKey || u.managerKey;}catch(e){}
    return clean(key || DEFAULT_COMPANY)
  }
  function firebasePath(){return [...arguments].map(x=>String(x||'').replace(/^\/+|\/+$/g,'')).filter(Boolean).join('/')}
  function firebaseJSONUrl(){return `${String(firebaseConfig.databaseURL||'').replace(/\/+$/,'')}/${firebasePath(...arguments)}.json`}
  function url(companyKey){return firebaseJSONUrl(ROOT_PATH,currentCompanyKey(companyKey))}
  function safeToast(msg){try{if(window.toast) window.toast(msg)}catch(e){}}
  function sameJSON(a,b){try{return JSON.stringify(a)===JSON.stringify(b)}catch(e){return false}}
  function editableElement(el){
    if(!el) return false;
    const tag=String(el.tagName||'').toLowerCase();
    return tag==='input'||tag==='textarea'||tag==='select'||el.isContentEditable||!!(el.closest&&el.closest('form,.modal,.dialog,[role=dialog]'));
  }
  function visible(el){
    if(!el) return false;
    const s=getComputedStyle(el);
    return s.display!=='none' && s.visibility!=='hidden' && el.offsetParent!==null;
  }
  function pageHasOpenEditor(){
    try{
      if(window.oskarForceNoRemoteRender) return true;
      if(document.querySelector('.scanner[style*="flex"], #reader')) return true;
      const modal=[...document.querySelectorAll('.modal-back,.modal,[role=dialog]')].some(m=>visible(m)&&m.querySelector('input,textarea,select,form'));
      if(modal) return true;
      const main=document.getElementById('mainCard');
      if(main && main.querySelector('form,#crudForm,#accForm,#editInvoiceForm,#manualDebtForm,#payDebtForm')) return true;
    }catch(e){}
    return false;
  }
  function markUserEditing(){state.lastUserEditAt=Date.now();}
  function userIsEditing(){
    try{if(typeof window.oskarIsUserEditing==='function' && window.oskarIsUserEditing()) return true;}catch(e){}
    if(pageHasOpenEditor()) return true;
    if(editableElement(document.activeElement)) return true;
    return Date.now()-state.lastUserEditAt<30000;
  }
  function itemPublicCopy(x){const o={}; Object.keys(x||{}).sort().forEach(k=>{if(!ITEM_META.has(k))o[k]=x[k]}); return o}
  function itemChanged(a,b){return !sameJSON(itemPublicCopy(a||{}), itemPublicCopy(b||{}))}
  function stamp(x){return Date.parse(x?._updatedAt||x?.updatedAt||x?._createdAt||x?.createdAt||x?.deletedAt||x?.date||0)||0}
  function settingsStamp(s){return Date.parse(s?._updatedAt||s?.updatedAt||0)||0}
  function isCollectionKey(k,v){return Array.isArray(v) && !META_KEYS.has(k)}
  function mergeMap(a,b){const out={...(isObj(a)?a:{})}; Object.keys(isObj(b)?b:{}).forEach(k=>{out[k]={...(out[k]||{}),...(b[k]||{})}}); return out}
  function collectDeleted(){
    const out={};
    for(const db of arguments){
      if(!isObj(db)) continue;
      DELETE_KEYS.forEach(key=>{const src=db[key]; if(!isObj(src))return; Object.keys(src).forEach(coll=>{out[coll]=out[coll]||{}; Object.assign(out[coll],src[coll]||{})})});
      Object.keys(db).forEach(coll=>{const arr=db[coll]; if(!Array.isArray(arr))return; arr.forEach(x=>{if(x&&x.id&&(x._deleted||x.deletedAt)){out[coll]=out[coll]||{}; out[coll][x.id]=x.deletedAt||x._updatedAt||now();}})});
    }
    return out;
  }
  function ensureDeleted(db){db.__deleted=mergeMap(db.__deleted,{}); db._deletedIds=mergeMap(db._deletedIds,{}); return db}
  function removeDeletedFromArrays(db){
    db=isObj(db)?db:{}; const del=collectDeleted(db);
    Object.keys(db).forEach(k=>{if(Array.isArray(db[k])){const d=del[k]||{}; db[k]=db[k].filter(x=>!(x&&x.id&&(d[x.id]||x._deleted||x.deletedAt)));}});
    db.__deleted=mergeMap(db.__deleted,del); db._deletedIds=mergeMap(db._deletedIds,del);
    return db;
  }
  function chooseItem(localItem,cloudItem,prefer){
    if(!localItem) return clone(cloudItem);
    if(!cloudItem) return clone(localItem);
    const ls=stamp(localItem), cs=stamp(cloudItem);
    if(ls>cs) return {...cloudItem,...localItem};
    if(cs>ls) return {...localItem,...cloudItem};
    return prefer==='cloud' ? {...localItem,...cloudItem} : {...cloudItem,...localItem};
  }
  function mergeArrays(localArr=[],cloudArr=[],coll='',deleted={},prefer='local'){
    const byId=new Map(), noId=[]; const del=deleted[coll]||{};
    function add(x,source){
      if(!x||typeof x!=='object') return;
      if(x.id){
        if(del[x.id]||x._deleted||x.deletedAt) return;
        const prev=byId.get(x.id);
        if(!prev) byId.set(x.id,{item:clone(x),source});
        else byId.set(x.id,{item:chooseItem(source==='local'?x:prev.item, source==='cloud'?x:prev.item, prefer),source:'merged'});
      }else{
        const key=JSON.stringify(x);
        if(!noId.some(y=>JSON.stringify(y)===key)) noId.push(clone(x));
      }
    }
    (cloudArr||[]).forEach(x=>add(x,'cloud'));
    (localArr||[]).forEach(x=>add(x,'local'));
    return [...byId.values()].map(v=>v.item).concat(noId);
  }
  function mergeSettings(local={},cloud={},prefer='local'){
    local=isObj(local)?local:{}; cloud=isObj(cloud)?cloud:{};
    const ls=settingsStamp(local), cs=settingsStamp(cloud);
    let out;
    if(ls && cs && cs>ls) out={...local,...cloud};
    else if(ls && cs && ls>cs) out={...cloud,...local};
    else out=prefer==='cloud'?{...local,...cloud}:{...cloud,...local};
    if(local.managerPassword && local.managerPassword!=='0000000000@@' && (!cloud.managerPassword || cloud.managerPassword==='0000000000@@')){
      out.managerPassword=local.managerPassword; out.forcePasswordChange=false;
    }
    out.companyKey=out.companyKey || local.companyKey || cloud.companyKey || DEFAULT_COMPANY;
    if(!out.managerPassword) out.managerPassword='0000000000@@';
    if(out.managerPassword==='0000000000@@') out.forcePasswordChange=true;
    return out;
  }
  function mergeDB(local={},cloud={},opts={}){
    const prefer=opts.prefer||'local'; local=isObj(local)?local:{}; cloud=isObj(cloud)?cloud:{};
    const deleted=collectDeleted(local,cloud);
    const out={...cloud,...local};
    const keys=new Set([...Object.keys(cloud),...Object.keys(local)]);
    keys.forEach(k=>{if(isCollectionKey(k,local[k])||isCollectionKey(k,cloud[k])) out[k]=mergeArrays(local[k]||[],cloud[k]||[],k,deleted,prefer)});
    out.settings=mergeSettings(local.settings,cloud.settings,prefer);
    out.__deleted=mergeMap(cloud.__deleted,local.__deleted); out.__deleted=mergeMap(out.__deleted,deleted);
    out._deletedIds=mergeMap(cloud._deletedIds,local._deletedIds); out._deletedIds=mergeMap(out._deletedIds,deleted);
    return removeDeletedFromArrays(out);
  }
  function normalizeDB(db){
    db=isObj(db)?db:{}; db.settings=db.settings||{}; db.settings.companyKey=db.settings.companyKey||currentCompanyKey();
    ensureDeleted(db); return removeDeletedFromArrays(db);
  }
  function markLocalChanges(db){
    db=normalizeDB(db||{}); const base=state.snapshot||readLocal(); const t=now(); let changed=false;
    Object.keys(db).forEach(coll=>{
      if(!Array.isArray(db[coll])||META_KEYS.has(coll)) return;
      const before=Array.isArray(base[coll])?base[coll]:[];
      const beforeMap=new Map(before.filter(x=>x&&x.id).map(x=>[String(x.id),x]));
      const afterIds=new Set();
      db[coll].forEach(x=>{
        if(!x||typeof x!=='object'||!x.id) return;
        afterIds.add(String(x.id));
        const old=beforeMap.get(String(x.id));
        if(!old){x._createdAt=x._createdAt||t; x._updatedAt=t; changed=true;}
        else if(itemChanged(old,x)){x._updatedAt=t; changed=true;}
      });
      beforeMap.forEach((old,id)=>{
        if(!afterIds.has(id) && old && !old._deleted && !old.deletedAt){
          db.__deleted[coll]=db.__deleted[coll]||{}; db._deletedIds[coll]=db._deletedIds[coll]||{};
          db.__deleted[coll][id]=t; db._deletedIds[coll][id]=t; changed=true;
        }
      });
    });
    if(!sameJSON((base&&base.settings)||{},db.settings||{})) { db.settings._updatedAt=t; changed=true; }
    if(changed){db.lastLocalUpdate=t; state.lastLocalSaveAt=Date.now();}
    return db;
  }
  async function requestJSON(method,data,companyKey){
    const options={method,cache:'no-store',headers:{'Content-Type':'application/json','Cache-Control':'no-cache','Pragma':'no-cache'}};
    if(data!==undefined) options.body=JSON.stringify(data||{});
    const r=await fetch(url(companyKey),options);
    if(!r.ok){let body=''; try{body=await r.text()}catch(e){} const err=new Error('تعذر الاتصال بفايربيز: '+r.status+' '+body.slice(0,120)); err.status=r.status; throw err;}
    try{return await r.json()}catch(e){return {}}
  }
  async function getCloud(companyKey){return await requestJSON('GET',undefined,companyKey)||{}}
  async function putCloud(db,companyKey){return await requestJSON('PUT',normalizeDB(db||{}),companyKey)}
  async function patchPath(path,data,companyKey){
    const cleanPath=String(path||'').replace(/^\/+|\/+$/g,'');
    const options={method:'PATCH',cache:'no-store',headers:{'Content-Type':'application/json','Cache-Control':'no-cache','Pragma':'no-cache'},body:JSON.stringify(data||{})};
    const r=await fetch(firebaseJSONUrl(ROOT_PATH,currentCompanyKey(companyKey),cleanPath),options);
    if(!r.ok){let body='';try{body=await r.text()}catch(e){}throw new Error('تعذر تحديث فايربيز: '+r.status+' '+body.slice(0,120));}
    try{return await r.json()}catch(e){return {}}
  }
  async function updateManagerPassword(password,companyKey){
    const pass=String(password||'').trim();
    if(!pass || pass==='0000000000@@' || pass.length<6) throw new Error('كلمة المرور الجديدة غير صالحة');
    const t=now();
    const db=normalizeDB(readLocal());
    db.settings=db.settings||{};
    db.settings.managerPassword=pass;
    db.settings.forcePasswordChange=false;
    db.settings._updatedAt=t;
    db.lastLocalUpdate=t;
    writeLocal(db);
    if(navigator.onLine){
      await patchPath('settings',{managerPassword:pass,forcePasswordChange:false,_updatedAt:t,companyKey:db.settings.companyKey||currentCompanyKey(companyKey)},companyKey||db.settings.companyKey);
      try{await syncCore(db,{companyKey:companyKey||db.settings.companyKey,rawLocal:true,prefer:'local'});}catch(e){console.warn(e)}
    }
    return db;
  }
  async function syncCore(localDB,opts={}){
    const companyKey=opts.companyKey || localDB?.settings?.companyKey || currentCompanyKey();
    let local=opts.rawLocal?normalizeDB(localDB||readLocal()):markLocalChanges(localDB||readLocal());
    const cloud=await getCloud(companyKey).catch(e=>{state.lastError=e; throw e});
    const merged=mergeDB(local,cloud,{prefer:opts.prefer||'local'});
    merged.lastSyncAt=now(); merged.lastLocalUpdate=merged.lastLocalUpdate||local.lastLocalUpdate||now();
    await putCloud(merged,companyKey).catch(e=>{state.lastError=e; throw e});
    writeLocal(merged); state.lastError=null; return merged;
  }
  function shouldAutoSync(){
    if(!navigator.onLine) return false;
    try{const u=JSON.parse(localStorage.getItem('currentUser')||'null'); if(u&&u.companyKey) return true;}catch(e){}
    return !/index\.html$/i.test(location.pathname) && !location.pathname.endsWith('/');
  }
  function queueSync(db){
    if(!shouldAutoSync()||state.applyingRemote) return;
    clearTimeout(state.syncTimer);
    state.syncTimer=setTimeout(async()=>{try{await syncCore(db||readLocal(),{prefer:'local'});}catch(e){console.warn(e);}},900);
  }
  async function pullMerge(companyKey,render=true){
    if(!navigator.onLine) return false;
    if(userIsEditing()) return false;
    if(Date.now()-state.lastLocalSaveAt<600) return false;
    const before=readLocal();
    const cloud=await getCloud(companyKey||before?.settings?.companyKey).catch(e=>{state.lastError=e; return null});
    if(!cloud || !Object.keys(cloud).length) return false;
    if(userIsEditing()) return false;
    const merged=mergeDB(before,cloud,{prefer:'cloud'}); merged.lastCloudPull=now();
    const changed=!sameJSON(before,merged);
    if(changed){
      state.applyingRemote=true;
      writeLocal(merged);
      try{window.DB=clone(merged);}catch(e){}
      state.applyingRemote=false;
      if(render) refreshPageFromDB();
    }
    return changed;
  }
  function refreshPageFromDB(){
    if(userIsEditing()){
      clearTimeout(state.deferredRenderTimer);
      state.deferredRenderTimer=setTimeout(()=>{if(!userIsEditing()) refreshPageFromDB();},1000);
      return;
    }
    try{window.dispatchEvent(new CustomEvent('oskar-db-updated',{detail:{source:'cloud'}}));}catch(e){}
    try{if(typeof window.loadDB==='function') window.DB=window.loadDB();}catch(e){}
    try{if(typeof window.renderPage==='function' && document.readyState!=='loading') window.renderPage();}catch(e){console.warn(e)}
  }

  window.FirebaseBridge={
    config:firebaseConfig, root:currentCompanyKey, lastError:()=>state.lastError,
    async pullWithKey(companyKey){
      const local=readLocal(); const cloud=await getCloud(companyKey);
      if(!cloud || !Object.keys(cloud).length){state.snapshot=clone(local); return local;}
      const merged=mergeDB(local,cloud,{prefer:'cloud'}); merged.lastCloudPull=now(); writeLocal(merged); return merged;
    },
    async pushWithKey(companyKey){
      const local=markLocalChanges(readLocal());
      let cloud={}; try{cloud=await getCloud(companyKey||local?.settings?.companyKey)}catch(e){cloud={}};
      const merged=mergeDB(local,cloud,{prefer:'local'}); merged.lastSyncAt=now();
      await putCloud(merged,companyKey||merged?.settings?.companyKey); writeLocal(merged); return merged;
    },
    async sync(localDB,opts={}){if(!navigator.onLine) return normalizeDB(localDB||readLocal()); return await syncCore(localDB||readLocal(),{...opts,prefer:opts.prefer||'local'});},
    async pull(){return await this.pullWithKey(readLocal()?.settings?.companyKey)},
    async push(){return await this.pushWithKey(readLocal()?.settings?.companyKey)},
    async livePull(){return await pullMerge(readLocal()?.settings?.companyKey,true)},
    async updateManagerPassword(password,companyKey){return await updateManagerPassword(password,companyKey||readLocal()?.settings?.companyKey)},
    queueSync
  };

  function installPageHooks(){
    if(typeof window.saveDB==='function' && !window.saveDB.__oskarSyncFixed){
      window.saveDB=function(db){
        try{db=markLocalChanges(db||window.DB||readLocal()); writeLocal(db); window.DB=db; queueSync(db); return db;}
        catch(e){console.warn(e); localStorage.setItem(APP_KEY,JSON.stringify(db||{})); return db;}
      };
      window.saveDB.__oskarSyncFixed=true;
    }
    if(typeof window.persist==='function' && !window.persist.__oskarSyncFixed){
      window.persist=function(){
        const db=window.DB||readLocal();
        if(typeof window.saveDB==='function') window.saveDB(db); else {const d=markLocalChanges(db); writeLocal(d); queueSync(d);}
        try{if(typeof window.updateSyncState==='function') window.updateSyncState();}catch(e){}
      };
      window.persist.__oskarSyncFixed=true;
    }
    if(typeof window.syncNow==='function' && !window.syncNow.__oskarSyncFixed){
      window.syncNow=async function(show=true){
        try{
          if(!navigator.onLine){if(show) safeToast('لا يوجد اتصال'); return;}
          const merged=await window.FirebaseBridge.sync(window.DB||readLocal(),{prefer:'local'});
          window.DB=clone(merged); state.snapshot=clone(merged);
          if(show) safeToast('تمت المزامنة');
          try{if(typeof window.renderPage==='function') window.renderPage();}catch(e){}
        }catch(e){console.warn(e); if(show) safeToast('تعذر المزامنة، تأكد من صلاحيات Realtime Database');}
      };
      window.syncNow.__oskarSyncFixed=true;
    }
    if(!state.started && typeof window.renderPage==='function'){
      state.started=true;
      startLivePull();
    }
  }
  function startLivePull(){
    clearInterval(state.pullTimer);
    state.pullTimer=setInterval(()=>{if(shouldAutoSync()) pullMerge(readLocal()?.settings?.companyKey,true).catch(e=>console.warn(e));},15000);
    window.addEventListener('focus',()=>{if(shouldAutoSync()&&!userIsEditing()) pullMerge(readLocal()?.settings?.companyKey,true).catch(()=>{})});
    window.addEventListener('online',()=>{queueSync(readLocal()); if(!userIsEditing()) pullMerge(readLocal()?.settings?.companyKey,true).catch(()=>{})});
  }
  document.addEventListener('input',markUserEditing,true);
  document.addEventListener('change',markUserEditing,true);
  document.addEventListener('focusin',e=>{if(editableElement(e.target)) markUserEditing();},true);
  document.addEventListener('keydown',e=>{if(editableElement(e.target)) markUserEditing();},true);
  document.addEventListener('touchstart',markUserEditing,{passive:true,capture:true});
  document.addEventListener('touchmove',markUserEditing,{passive:true,capture:true});
  document.addEventListener('wheel',markUserEditing,{passive:true,capture:true});
  document.addEventListener('scroll',markUserEditing,{passive:true,capture:true});
  state.snapshot=clone(readLocal());
  [0,80,250,600,1200,2500].forEach(ms=>setTimeout(installPageHooks,ms));
  document.addEventListener('DOMContentLoaded',()=>{installPageHooks(); setTimeout(installPageHooks,500);});
})();

/* ===== OSKAR MOBILE SIDEBAR FIX - 2026-05-08 ===== */
(function(){
  if(window.__OSKAR_MOBILE_SIDEBAR_FIX__) return;
  window.__OSKAR_MOBILE_SIDEBAR_FIX__ = true;
  const css = `
    @media (max-width:1099.98px){
      html body .drawer:not(.open){transform:translateX(105%) translateZ(0) !important;visibility:visible !important;}
      html body .drawer.open{transform:translateX(0) translateZ(0) !important;visibility:visible !important;}
      html body .drawer-overlay:not(.show){display:none !important;}
      html body .drawer-overlay.show{display:block !important;}
    }
    @media (min-width:1100px){
      html body .drawer{transform:none !important;right:0 !important;top:48px !important;width:280px !important;height:calc(100vh - 48px) !important;}
      html body .drawer-overlay{display:none !important;}
      html body .page{margin-right:280px !important;}
      html body .fab, html body .topbar .menu-open{display:none !important;}
    }`;
  function installStyle(){if(document.getElementById('oskar-mobile-sidebar-fix-style')) return; const st=document.createElement('style'); st.id='oskar-mobile-sidebar-fix-style'; st.textContent=css; (document.head||document.documentElement).appendChild(st);}
  installStyle();
  const isMobile=()=>window.matchMedia&&window.matchMedia('(max-width:1099.98px)').matches;
  function setHomeOpenOnly(){const drawer=document.getElementById('drawer')||document.querySelector('.drawer'); if(!drawer||!isMobile())return; drawer.querySelectorAll('.menu-group').forEach(group=>{const title=String(group.querySelector('.menu-head b')?.textContent||'').trim(); if(title==='الرئيسية') group.classList.add('open'); else group.classList.remove('open');});}
  function closeMobileDrawerOnStart(){if(!isMobile())return; const drawer=document.getElementById('drawer')||document.querySelector('.drawer'); const overlay=document.getElementById('drawerOverlay')||document.querySelector('.drawer-overlay'); if(drawer)drawer.classList.remove('open'); if(overlay)overlay.classList.remove('show');}
  function applyInitialMobileState(){installStyle(); closeMobileDrawerOnStart(); setHomeOpenOnly();}
  function scheduleInitial(){[0,80,220,500,900].forEach(ms=>setTimeout(applyInitialMobileState,ms));}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',scheduleInitial,{once:true}); else scheduleInitial();
  window.addEventListener('resize',()=>{installStyle(); if(!isMobile()){const drawer=document.getElementById('drawer')||document.querySelector('.drawer'); const overlay=document.getElementById('drawerOverlay')||document.querySelector('.drawer-overlay'); if(drawer)drawer.classList.remove('open'); if(overlay)overlay.classList.remove('show');}});
})();

/* ===== R24 final stability, sync queue, scroll/table/input polish ===== */
(function(){
  if(window.__OSKAR_R24_FINAL__) return; window.__OSKAR_R24_FINAL__=true;
  const APP_KEY='supermarket_pos_ar_v1';
  const PENDING_KEY='oskar_pending_sync_operations';
  const LAST_SAVE_KEY='oskar_last_save_seen';
  const SELECTOR_TABLES='.table-wrap,.table-responsive,.data-table-wrap,.report-table,.smart-table-wrap';
  function css(){return `
html,body{height:auto!important;min-height:100%!important;overflow-y:auto!important;overflow-x:hidden!important;position:static!important;touch-action:pan-y pan-x!important;overscroll-behavior:auto!important;-webkit-overflow-scrolling:touch!important}
body{background:linear-gradient(180deg,#f6fbfa,#edf5f2 260px,#f8fcfb)!important;color:#10251f!important}
body.oskar-form-page,body.oskar-form-page .page,body.oskar-form-page .content{background:linear-gradient(180deg,#f6fbfa,#edf5f2 260px,#f8fcfb)!important}
body.oskar-form-page #mainCard.card{background:#fff!important;border:1px solid #d9e8e1!important;box-shadow:0 16px 38px rgba(6,78,59,.10)!important;padding:18px!important}
.app,.page,main,#mainCard{height:auto!important;min-height:auto!important;overflow:visible!important;max-width:1280px!important}
.page{padding-bottom:120px!important;width:100%!important}
.card{overflow:visible!important}
${SELECTOR_TABLES}{max-width:100%!important;overflow-x:auto!important;overflow-y:visible!important;-webkit-overflow-scrolling:touch!important;touch-action:pan-x pan-y!important;overscroll-behavior:contain!important;display:block!important;direction:rtl!important;scroll-behavior:auto!important}
.table-wrap table,.table-responsive table,.data-table,.report-table table,#mainCard table{min-width:760px!important;width:max-content!important;max-width:none!important;border-collapse:collapse!important}
.data-table th,.data-table td,#mainCard table th,#mainCard table td{white-space:nowrap!important}
.grid,.two-col-form,.grid2{display:grid!important;grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:14px!important;align-items:start!important}
@media(max-width:560px){.grid,.two-col-form,.grid2{grid-template-columns:repeat(2,minmax(0,1fr))!important;gap:10px!important}.field input,.field select,.field textarea,input.search,.search{font-size:15px!important;min-height:52px!important}.field label{font-size:12px!important}.table-wrap table,.table-responsive table,.data-table,.report-table table,#mainCard table{min-width:720px!important}}
.field{position:relative!important;min-width:0!important;gap:7px!important}.field label{font-weight:950!important;color:#19493e!important;margin-bottom:6px!important;display:block!important}.field input,.field select,.field textarea,input.search,.search{width:100%!important;border:1px solid #d9e8e1!important;border-radius:18px!important;background:#fff!important;color:#10251f!important;min-height:56px!important;padding:12px 52px 12px 14px!important;box-shadow:0 10px 22px rgba(6,78,59,.065)!important;outline:none!important}.field textarea{min-height:105px!important}.field input:focus,.field select:focus,.field textarea:focus,input.search:focus,.search:focus{border-color:#409898!important;box-shadow:0 0 0 4px rgba(64,152,152,.14),0 12px 26px rgba(6,78,59,.08)!important}.field input::placeholder,.field textarea::placeholder{color:#98aaa3!important;font-weight:800!important}.field:after{content:""!important;position:absolute!important;right:16px!important;bottom:15px!important;width:23px!important;height:23px!important;opacity:.62!important;pointer-events:none!important;background-size:contain!important;background-repeat:no-repeat!important;background-position:center!important;background-image:var(--oskar-field-icon,url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2370828b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 6h16M4 12h16M4 18h16'/%3E%3C/svg%3E"))!important}.field:has(textarea):after{bottom:66px!important}.field-icon-user{--oskar-field-icon:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2370828b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 21a8 8 0 0 0-16 0'/%3E%3Ccircle cx='12' cy='7' r='4'/%3E%3C/svg%3E")}.field-icon-phone{--oskar-field-icon:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2370828b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M22 16.92v3a2 2 0 0 1-2.18 2A19.8 19.8 0 0 1 3.09 5.18 2 2 0 0 1 5.11 3h3a2 2 0 0 1 2 1.72c.12.9.32 1.77.6 2.6a2 2 0 0 1-.45 2.11L9 10.7a16 16 0 0 0 4.3 4.3l1.27-1.27a2 2 0 0 1 2.11-.45c.83.28 1.7.48 2.6.6A2 2 0 0 1 22 16.92z'/%3E%3C/svg%3E")}.field-icon-money{--oskar-field-icon:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2370828b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='12' cy='12' r='9'/%3E%3Cpath d='M14.8 8.8a3 3 0 0 0-5.6 1.4c0 3.6 5.6 1.8 5.6 5.2a3 3 0 0 1-5.6 1.4M12 6v12'/%3E%3C/svg%3E")}.field-icon-barcode{--oskar-field-icon:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2370828b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M3 5v14M7 5v14M11 5v14M15 5v14M21 5v14'/%3E%3Cpath d='M5 5h1M13 5h1M17 5h2'/%3E%3C/svg%3E")}.field-icon-date{--oskar-field-icon:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2370828b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='3' y='4' width='18' height='18' rx='2'/%3E%3Cpath d='M16 2v4M8 2v4M3 10h18'/%3E%3C/svg%3E")}.field-icon-note{--oskar-field-icon:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2370828b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 4h16v16H4z'/%3E%3Cpath d='M8 8h8M8 12h8M8 16h5'/%3E%3C/svg%3E")}.field-icon-product{--oskar-field-icon:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2370828b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m21 8-9-5-9 5 9 5 9-5Z'/%3E%3Cpath d='M3 8v8l9 5 9-5V8M12 13v8'/%3E%3C/svg%3E")}.field-icon-list{--oskar-field-icon:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2370828b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M8 6h13M8 12h13M8 18h13'/%3E%3Cpath d='M3 6h.01M3 12h.01M3 18h.01'/%3E%3C/svg%3E")}.field-icon-qty{--oskar-field-icon:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2370828b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 9h16M4 15h16M10 3 8 21M16 3l-2 18'/%3E%3C/svg%3E")}.field-icon-account{--oskar-field-icon:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2370828b' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Crect x='2' y='5' width='20' height='14' rx='2'/%3E%3Cpath d='M2 10h20M6 15h4'/%3E%3C/svg%3E")}
.product-results,.popular-grid{display:grid!important;grid-template-columns:repeat(3,minmax(0,1fr))!important;gap:9px!important;width:100%!important}.product-card,.popular-card{min-width:0!important;min-height:88px!important;border-radius:18px!important;padding:10px!important;overflow:hidden!important}.product-card b,.popular-card b{display:block!important;font-size:12px!important;line-height:1.35!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important}.popular-card small,.product-card small{font-size:11px!important;word-break:normal!important}.sync-count{position:absolute!important;top:-8px!important;left:-8px!important;min-width:21px!important;height:21px!important;border-radius:999px!important;background:#ef4444!important;color:#fff!important;font-size:11px!important;font-weight:950!important;border:2px solid #fff!important;display:none;align-items:center!important;justify-content:center!important;animation:none!important;transform:none!important;z-index:5!important}.oskar-sync-btn,.sync-button{position:relative!important;width:44px!important;min-width:44px!important;height:42px!important;padding:0!important;border-radius:16px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;background:rgba(255,255,255,.16)!important;border:1px solid rgba(255,255,255,.30)!important;color:#fff!important;font-size:0!important}.oskar-sync-icon svg{width:23px!important;height:23px!important;display:block!important;fill:none!important;stroke:currentColor!important;stroke-width:2.15!important;stroke-linecap:round!important;stroke-linejoin:round!important}.oskar-sync-icon.syncing svg{animation:oskarSpin .8s linear infinite!important}@keyframes oskarSpin{to{transform:rotate(360deg)}}
`;}
  function installStyle(){let st=document.getElementById('oskar-r24-final-style'); if(!st){st=document.createElement('style'); st.id='oskar-r24-final-style';} st.textContent=css(); (document.head||document.documentElement).appendChild(st);}
  function pending(){return Math.max(0,Number(localStorage.getItem(PENDING_KEY)||0)||0)}
  function setPending(n){localStorage.setItem(PENDING_KEY,String(Math.max(0,Number(n)||0))); updateSyncUI();}
  function incPending(){setPending(pending()+1)}
  function syncButton(){
    let btn=[...document.querySelectorAll('button,.icon-btn,.top-pill')].find(x=>/syncNow/.test(x.getAttribute('onclick')||'')||/مزامنة|↻|⟳/.test((x.textContent||'').trim()));
    if(!btn) return null;
    btn.classList.add('oskar-sync-btn'); btn.style.position='relative';
    btn.innerHTML='<span class="oskar-sync-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 0 0-15-6.7L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 15 6.7l3-2.7"/><path d="M21 21v-5h-5"/></svg></span><span class="sync-count"></span>';
    return btn;
  }
  function updateSyncUI(){
    const btn=syncButton(); const n=pending();
    if(btn){const c=btn.querySelector('.sync-count'); if(c){c.textContent=n; c.style.display=n>0?'inline-flex':'none';}}
    const badge=document.getElementById('syncState'); if(badge){badge.textContent=navigator.onLine?'متصل':'بدون نت'; badge.classList.toggle('offline',!navigator.onLine);}
  }
  function classifyFields(){
    document.querySelectorAll('.field').forEach(f=>{
      if(f.dataset.oskarClassified) return; f.dataset.oskarClassified='1';
      const label=(f.querySelector('label')?.textContent||'').trim(); const ctl=f.querySelector('input,select,textarea'); if(!ctl) return;
      const hay=(label+' '+(ctl.name||'')+' '+(ctl.id||'')+' '+(ctl.placeholder||'')).toLowerCase();
      if(/عميل|زبون|مورد|موظف|user|customer|supplier|employee|name/.test(hay)) f.classList.add('field-icon-user');
      else if(/جوال|هاتف|موبايل|phone|mobile/.test(hay)) f.classList.add('field-icon-phone');
      else if(/باركود|barcode|sku/.test(hay)) f.classList.add('field-icon-barcode');
      else if(/سعر|مبلغ|مدفوع|خصم|رصيد|اجمالي|إجمالي|total|price|amount|balance|paid/.test(hay)) f.classList.add('field-icon-money');
      else if(/تاريخ|date/.test(hay)) f.classList.add('field-icon-date');
      else if(/صنف|منتج|product|item/.test(hay)) f.classList.add('field-icon-product');
      else if(/عدد|كمية|quantity|qty|count/.test(hay)) f.classList.add('field-icon-qty');
      else if(/حساب|دفع|payment|account/.test(hay)) f.classList.add('field-icon-account');
      else if(ctl.tagName==='SELECT'||/تصنيف|وحدة|فرع|نوع|طريقة|category|unit|type|method/.test(hay)) f.classList.add('field-icon-list');
      else if(/ملاحظة|وصف|عنوان|note|address|description/.test(hay)) f.classList.add('field-icon-note');
      else f.classList.add('field-icon-list');
      if((ctl.tagName==='INPUT'||ctl.tagName==='TEXTAREA')&&!ctl.placeholder){ctl.placeholder='أدخل '+(label||'القيمة');}
      if(ctl.tagName==='SELECT'){const first=ctl.options&&ctl.options[0]; if(first && !first.textContent.trim()) first.textContent='اختر '+(label||'قيمة');}
    });
    document.querySelectorAll('input:not([placeholder])').forEach(i=>{const lab=i.closest('.field')?.querySelector('label')?.textContent?.trim()||i.name||i.id||'القيمة'; i.placeholder='أدخل '+lab;});
    document.querySelectorAll('textarea:not([placeholder])').forEach(i=>{const lab=i.closest('.field')?.querySelector('label')?.textContent?.trim()||i.name||i.id||'الملاحظة'; i.placeholder='أدخل '+lab;});
  }
  function restoreScroll(){
    document.documentElement.style.overflowY='auto'; document.documentElement.style.height='auto'; document.body.style.overflowY='auto'; document.body.style.height='auto'; document.body.style.position='static';
    [...document.querySelectorAll(SELECTOR_TABLES),...Array.from(document.querySelectorAll('.card,#mainCard')).filter(x=>x.querySelector&&x.querySelector('table'))].forEach(w=>{w.style.overflowX='auto'; w.style.webkitOverflowScrolling='touch'; w.style.touchAction='pan-x pan-y';});
  }
  function dbSnapshot(){try{return localStorage.getItem(APP_KEY)||''}catch(e){return ''}}
  function wrapSaves(){
    if(window.saveDB && !window.saveDB.__r24Pending){
      const old=window.saveDB;
      window.saveDB=function(db){const before=dbSnapshot(); const r=old.apply(this,arguments); const after=dbSnapshot(); if(before!==after && !navigator.onLine) incPending(); return r;};
      window.saveDB.__r24Pending=true;
    }
    if(window.persist && !window.persist.__r24Pending){
      const old=window.persist;
      window.persist=function(){const before=dbSnapshot(); const r=old.apply(this,arguments); const after=dbSnapshot(); if(before!==after && !navigator.onLine) incPending(); return r;};
      window.persist.__r24Pending=true;
    }
    if(window.syncNow && !window.syncNow.__r24Queue){
      const old=window.syncNow;
      window.syncNow=async function(show=true){
        const btn=syncButton(), icon=btn&&btn.querySelector('.oskar-sync-icon'); if(icon) icon.classList.add('syncing');
        try{
          if(!navigator.onLine){if(show&&window.toast)toast('لا يوجد اتصال، سيتم الحفظ محليًا'); updateSyncUI(); return;}
          let n=pending();
          if(n>0){
            while(n>0){await old.call(this,false); n=Math.max(0,n-1); setPending(n); await new Promise(r=>setTimeout(r,120));}
            if(show&&window.toast)toast('تمت مزامنة العمليات المحفوظة');
          }else{await old.call(this,show); setPending(0);}
        }catch(e){console.warn(e); if(show&&window.toast)toast('تعذر المزامنة، البيانات محفوظة محليًا');}
        finally{if(icon) icon.classList.remove('syncing'); updateSyncUI();}
      };
      window.syncNow.__r24Queue=true;
    }
  }
  function afterRender(){installStyle(); restoreScroll(); classifyFields(); updateSyncUI(); wrapSaves();}
  installStyle();
  const mo=new MutationObserver(()=>{clearTimeout(window.__r24_mo); window.__r24_mo=setTimeout(afterRender,80);});
  function start(){afterRender(); try{mo.observe(document.documentElement,{childList:true,subtree:true});}catch(e){} [100,500,1200,2500].forEach(t=>setTimeout(afterRender,t));}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
  window.addEventListener('online',()=>{updateSyncUI(); if(pending()>0&&window.syncNow)setTimeout(()=>window.syncNow(false),350);});
  window.addEventListener('offline',updateSyncUI);
})();

/* ===== R27 compact field/modal/customer fixes ===== */
(function(){
  'use strict';
  if(window.__OSKAR_R27_COMPACT_FIX__) return;
  window.__OSKAR_R27_COMPACT_FIX__ = true;

  var APP_KEY = 'supermarket_pos_ar_v1';
  var ICONS = {
    close:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
    debt:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14a3.5 3.5 0 0 1 0 7H6"/></svg>',
    pay:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M7 15h4"/><path d="m15 15 2 2 4-5"/></svg>',
    ledger:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/></svg>',
    user:'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/></svg>'
  };

  function $(s,p){return (p||document).querySelector(s)}
  function $$(s,p){return Array.prototype.slice.call((p||document).querySelectorAll(s))}
  function byId(id){return document.getElementById(id)}
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(m){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]})}
  function num(v){var n=Number(v||0); return isFinite(n)?n:0}
  function db(){try{if(window.DB && typeof window.DB==='object') return window.DB; window.DB=JSON.parse(localStorage.getItem(APP_KEY)||'{}')||{}; return window.DB;}catch(e){window.DB={}; return window.DB}}
  function arr(k){var d=db(); if(!Array.isArray(d[k])) d[k]=[]; return d[k]}
  function rows(k){return arr(k).filter(function(x){return x && !x._deleted && !x.deletedAt})}
  function uid(p){try{return typeof window.uid==='function'?window.uid(p):(p+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7))}catch(e){return p+'-'+Date.now()}}
  function nowText(){try{return typeof window.nowText==='function'?window.nowText():new Date().toLocaleString('ar-EG',{hour12:false})}catch(e){return new Date().toISOString()}}
  function money(n){try{if(typeof window.money==='function') return window.money(n); if(typeof window.money2==='function') return window.money2(n); if(typeof window.mon==='function') return window.mon(n);}catch(e){} return Number(n||0).toFixed(2)+' '+(((db().settings||{}).currency)||'₪')}
  function toast(m){try{if(typeof window.toast==='function') window.toast(m); else console.log(m)}catch(e){}}
  function persist(){try{localStorage.setItem(APP_KEY,JSON.stringify(db()))}catch(e){} try{if(typeof window.persist==='function') window.persist(); else if(typeof window.saveDB==='function') window.saveDB(db());}catch(e){console.warn(e)}}

  function installStyle(){
    var st=byId('oskar-r27-compact-style');
    if(!st){st=document.createElement('style'); st.id='oskar-r27-compact-style';}
    st.textContent = ''+
'.grid.oskar-single-fields,.grid2.oskar-single-fields,.two-col-form.oskar-single-fields,form.oskar-single-fields,#mainCard .grid.oskar-single-fields,.modal .grid.oskar-single-fields,.smart-modal .grid.oskar-single-fields{display:grid!important;grid-template-columns:1fr!important;gap:18px!important;width:100%!important;align-items:start!important}\n'+
'.grid.oskar-single-fields>.field,.grid2.oskar-single-fields>.field,.two-col-form.oskar-single-fields>.field,form.oskar-single-fields>.field,.modal .grid.oskar-single-fields>.field,.smart-modal .grid.oskar-single-fields>.field{grid-column:1/-1!important;width:100%!important;max-width:none!important}\n'+
'.field.full-row,.full-row,.field[style*="grid-column:1/-1"]{grid-column:1/-1!important;width:100%!important}\n'+
'.oskar-sheet-handle{position:absolute!important;top:12px!important;left:50%!important;transform:translateX(-50%)!important;width:96px!important;height:7px!important;border-radius:999px!important;background:#e5e7eb!important;z-index:5!important;cursor:grab!important;touch-action:none!important}\n'+
'.oskar-sheet-dragging{transition:none!important;cursor:grabbing!important}\n'+
'.oskar-close-btn{width:40px!important;height:40px!important;min-width:40px!important;border-radius:14px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;padding:0!important;font-size:0!important;background:#fff0f0!important;color:#b91c1c!important;border:1px solid #fecaca!important;box-shadow:0 6px 16px rgba(185,28,28,.09)!important}\n'+
'.oskar-close-btn svg,.r27-actions svg{width:22px!important;height:22px!important;stroke:currentColor!important;fill:none!important;stroke-width:2.35!important;stroke-linecap:round!important;stroke-linejoin:round!important}\n'+
'.r27-actions{display:flex!important;gap:10px!important;justify-content:center!important;align-items:center!important;flex-wrap:wrap!important;margin:15px 0!important}.r27-actions .btn{min-height:48px!important;border-radius:16px!important;gap:8px!important;display:inline-flex!important;align-items:center!important;justify-content:center!important}.r27-debt-amount{display:block;padding:14px 16px;border:1px solid #d9e8e1;border-radius:18px;background:#f6fbfa;font-weight:950;color:#0f766e}\n'+
'#modalBack.oskar-r27-custom>.modal>.tools{display:none!important}\n'+
'@media(max-width:760px){.modal-back,.smart-modal-back{align-items:flex-end!important;justify-content:center!important;padding:0!important;background:rgba(0,0,0,.42)!important;overscroll-behavior:contain!important}.modal,.smart-modal{position:relative!important;width:100vw!important;max-width:100vw!important;max-height:92vh!important;overflow:auto!important;border-radius:34px 34px 0 0!important;padding-top:48px!important;touch-action:pan-y!important;transition:transform .18s ease!important}.modal-head,.smart-modal-head{touch-action:none!important}}\n';
    (document.head||document.documentElement).appendChild(st);
  }

  function markFieldLayouts(root){
    root = root || document;
    $$('.grid,.grid2,.two-col-form,form', root).forEach(function(g){
      if(g.classList.contains('product-results') || g.classList.contains('popular-grid') || g.classList.contains('kpis')) return;
      if(g.querySelector('.field input,.field select,.field textarea') || (g.tagName==='FORM' && g.querySelector('input,select,textarea'))) g.classList.add('oskar-single-fields');
    });
  }

  function closeAllModals(){
    try{
      var mb=byId('modalBack');
      if(mb){mb.style.display='none'; mb.classList.remove('oskar-r27-custom'); var m=mb.querySelector('.modal'); if(m)m.style.transform='';}
      $$('.modal-back:not(#modalBack),.smart-modal-back,#smartModalBack').forEach(function(x){x.remove()});
      $$('.modal,.smart-modal').forEach(function(m){m.style.transform=''});
    }catch(e){console.warn(e)}
  }

  function prepareModal(modal){
    if(!modal || modal.dataset.oskarR27Ready) return;
    modal.dataset.oskarR27Ready='1';
    if(!modal.querySelector('.oskar-sheet-handle')) modal.insertAdjacentHTML('afterbegin','<div class="oskar-sheet-handle" data-oskar-drag="1" aria-hidden="true"></div>');
    var head = modal.querySelector('.modal-head,.smart-modal-head');
    if(!head){head=document.createElement('div'); head.className=modal.classList.contains('smart-modal')?'smart-modal-head':'modal-head'; modal.insertBefore(head, modal.children[1] || modal.firstChild)}
    var btn = head.querySelector('[data-oskar-close],button[onclick*="closeModal"],button[onclick*="remove"],button.danger');
    if(!btn){btn=document.createElement('button'); btn.type='button'; head.appendChild(btn)}
    btn.setAttribute('type','button'); btn.setAttribute('data-oskar-close','1'); btn.classList.add('oskar-close-btn'); btn.innerHTML=ICONS.close;
  }

  function setupModals(root){
    root = root || document;
    $$('.modal,.smart-modal', root).forEach(prepareModal);
    $$('button', root).forEach(function(b){
      var txt=(b.textContent||'').trim(); var oc=b.getAttribute('onclick')||'';
      if(b.closest('.modal,.smart-modal') && (/^(×|x)$/i.test(txt) || /إغلاق|اغلاق|Close/i.test(txt) || /closeModal|smartModalBack|remove\(\)/.test(oc))){
        b.setAttribute('type','button'); b.setAttribute('data-oskar-close','1'); b.classList.add('oskar-close-btn'); if(!b.querySelector('svg')) b.innerHTML=ICONS.close;
      }
    });
  }

  function ensureMainModal(){
    var back=byId('modalBack');
    if(!back){back=document.createElement('div'); back.id='modalBack'; back.className='modal-back'; document.body.appendChild(back)}
    var modal=back.querySelector('.modal');
    if(!modal){modal=document.createElement('div'); modal.className='modal'; back.appendChild(modal)}
    var head=modal.querySelector('.modal-head');
    if(!head){head=document.createElement('div'); head.className='modal-head'; modal.insertBefore(head, modal.firstChild)}
    var title=head.querySelector('#modalTitle,h3');
    if(!title){title=document.createElement('h3'); title.id='modalTitle'; head.insertBefore(title, head.firstChild)}
    var close=head.querySelector('[data-oskar-close],button') || document.createElement('button');
    if(!close.parentNode) head.appendChild(close);
    close.type='button'; close.classList.add('oskar-close-btn'); close.setAttribute('data-oskar-close','1'); close.innerHTML=ICONS.close;
    var body=modal.querySelector('#modalBody');
    if(!body){body=document.createElement('div'); body.id='modalBody'; modal.appendChild(body)}
    prepareModal(modal);
    return {back:back, modal:modal, title:title, body:body};
  }

  function openR27Modal(title, html){
    var m=ensureMainModal();
    m.back.classList.add('oskar-r27-custom');
    m.title.textContent = title || '';
    m.body.innerHTML = html || '';
    m.back.style.display = 'flex';
    m.modal.style.transform='';
    setTimeout(function(){markFieldLayouts(m.modal); setupModals(m.modal)},0);
    return m;
  }

  var oldClose = window.closeModal;
  window.closeModal = function(){try{if(oldClose) oldClose.apply(this, arguments)}catch(e){} closeAllModals()};
  window.oskarCloseAnyModal = closeAllModals;

  function customerById(id){return rows('customers').filter(function(c){return String(c.id)===String(id)})[0] || {}}
  function customerDebt(c){
    c=c||{}; var id=String(c.id||''), name=String(c.name||''); var total=0;
    rows('debts').forEach(function(d){if(d.partyType==='customer' && (String(d.partyId||'')===id || String(d.partyName||'')===name)){var rem=d.remaining!==undefined?num(d.remaining):(num(d.amount)-num(d.paid)); if(rem>0) total+=rem;}});
    rows('sales').forEach(function(s){if((String(s.customerId||'')===id || String(s.customerName||'')===name) && num(s.due)>0) total+=num(s.due)});
    return total;
  }
  window.customerDebt = customerDebt;

  function simpleTable(data, cols){
    return '<div class="table-wrap"><table class="data-table"><thead><tr>'+cols.map(function(c){return '<th>'+esc(c)+'</th>'}).join('')+'</tr></thead><tbody>'+data.map(function(r){return '<tr>'+cols.map(function(c){return '<td>'+esc(r[c])+'</td>'}).join('')+'</tr>'}).join('')+'</tbody></table></div>';
  }

  function addMovement(accountId,type,amount,source,note){
    try{if(typeof window.addMovement==='function'){window.addMovement(accountId,type,amount,source,note); return;}}catch(e){}
    var a=arr('accounts').filter(function(x){return String(x.id||x.name)===String(accountId)})[0];
    var before=num(a&&a.balance); if(a) a.balance = type==='in' ? before+amount : before-amount;
    arr('accountMovements').unshift({id:uid('mov'),date:nowText(),accountId:accountId,accountName:(a&&a.name)||accountId,type:type,amount:amount,balanceBefore:before,balanceAfter:a?num(a.balance):0,source:source,note:note||''});
  }

  function installCustomerFixes(){
    if(window.__OSKAR_R27_CUSTOMER_FUNCS__) return;
    window.__OSKAR_R27_CUSTOMER_FUNCS__=true;

    window.openCustomerLedger = function(id){
      var c=customerById(id), name=c.name||'';
      var sales=rows('sales').filter(function(s){return String(s.customerId||'')===String(id)||String(s.customerName||'')===String(name)});
      var debts=rows('debts').filter(function(d){return d.partyType==='customer'&&(String(d.partyId||'')===String(id)||String(d.partyName||'')===String(name))});
      var pays=rows('debtPayments').filter(function(p){return String(p.partyId||'')===String(id)||String(p.partyName||'')===String(name)||debts.some(function(d){return d.id===p.debtId})});
      var html='<div class="kpis"><div class="kpi"><span>إجمالي الدين</span><strong>'+money(customerDebt(c))+'</strong></div><div class="kpi"><span>عدد الفواتير</span><strong>'+sales.length+'</strong></div><div class="kpi"><span>دفعات السداد</span><strong>'+pays.length+'</strong></div><div class="kpi"><span>الهاتف</span><strong style="font-size:17px">'+esc(c.mobile||c.phone||'')+'</strong></div></div>'+
      '<div class="r27-actions"><button type="button" class="btn primary" data-r27-action="manualDebt" data-id="'+esc(id)+'">'+ICONS.debt+'دين يدوي</button><button type="button" class="btn success" data-r27-action="quickPay" data-id="'+esc(id)+'">'+ICONS.pay+'سداد دين</button><button type="button" class="btn ghost" data-oskar-close="1">'+ICONS.close+'إغلاق</button></div>'+
      '<h3>الفواتير</h3>'+simpleTable(sales,['date','invoiceNo','customerName','total','paid','due','paymentMethod'])+'<h3>الديون</h3>'+simpleTable(debts,['date','partyName','amount','paid','remaining','source','status'])+'<h3>دفعات السداد</h3>'+simpleTable(pays,['date','partyName','amount','accountId','note']);
      openR27Modal('سجل العميل - '+name, html);
    };

    window.openManualDebtForCustomer = function(id){
      var c=customerById(id);
      var html='<form id="manualDebtForm" class="grid"><input type="hidden" name="customerId" value="'+esc(id)+'"><input type="hidden" name="partyName" value="'+esc(c.name||'')+'"><div class="field"><label>المبلغ</label><input name="amount" type="number" step="0.01" min="0" required></div><div class="field"><label>نوع الدين</label><select name="source"><option>دين يدوي</option><option>تطبيق لاحق</option></select></div><div class="field full-row"><label>ملاحظة</label><input name="note" placeholder="ملاحظة اختيارية"></div></form><div class="r27-actions"><button type="button" class="btn primary" data-r27-action="saveManualDebt">'+ICONS.debt+'حفظ الدين</button><button type="button" class="btn ghost" data-r27-action="ledger" data-id="'+esc(id)+'">'+ICONS.ledger+'رجوع للسجل</button><button type="button" class="btn ghost" data-oskar-close="1">'+ICONS.close+'إغلاق</button></div>';
      openR27Modal('دين يدوي على '+(c.name||''), html);
    };

    window.saveManualDebt = function(){
      var f=byId('manualDebtForm'); if(!f) return toast('افتح نموذج الدين أولاً');
      var d=Object.fromEntries(new FormData(f).entries()); var amount=num(d.amount); if(amount<=0) return toast('أدخل مبلغ الدين');
      var rec={id:uid('debt'),date:nowText(),partyType:'customer',partyId:d.customerId||'',partyName:d.partyName||'',amount:amount,paid:0,remaining:amount,source:d.source||'دين يدوي',note:d.note||'',status:'مستحق'};
      arr('debts').unshift(rec); arr('manualDebts').unshift(Object.assign({},rec,{sourceId:rec.id})); persist(); toast('تم تسجيل الدين'); window.openCustomerLedger(d.customerId);
    };

    window.openQuickDebtPayment = function(id){
      var c=customerById(id), debt=customerDebt(c), accounts=rows('accounts');
      var opts='<option value="cash-main">الصندوق الرئيسي</option>'+accounts.map(function(a){return '<option value="'+esc(a.id||a.name)+'">'+esc(a.name||a.id)+'</option>'}).join('');
      var html='<form id="quickPayForm" class="grid"><div class="field"><label>إجمالي الدين</label><b class="r27-debt-amount">'+money(debt)+'</b></div><div class="field"><label>قيمة الدفعة</label><input name="amount" type="number" step="0.01" min="0" value="'+esc(debt)+'" required></div><div class="field"><label>الحساب</label><select name="accountId">'+opts+'</select></div><div class="field full-row"><label>ملاحظة</label><input name="note" placeholder="ملاحظة اختيارية"></div></form><div class="r27-actions"><button type="button" class="btn success" data-r27-action="saveQuickPay" data-id="'+esc(id)+'">'+ICONS.pay+'حفظ السداد</button><button type="button" class="btn ghost" data-r27-action="ledger" data-id="'+esc(id)+'">'+ICONS.ledger+'رجوع للسجل</button><button type="button" class="btn ghost" data-oskar-close="1">'+ICONS.close+'إغلاق</button></div>';
      openR27Modal('سداد دين - '+(c.name||''), html);
    };

    window.saveQuickCustomerPayment = function(id){
      var c=customerById(id), f=byId('quickPayForm'); if(!f) return toast('افتح نموذج السداد أولاً');
      var amount=num(f.amount&&f.amount.value), debt=customerDebt(c); if(amount<=0) return toast('أدخل قيمة السداد'); if(debt>0 && amount>debt) amount=debt;
      var remaining=amount, account=(f.accountId&&f.accountId.value)||'cash-main', note=(f.note&&f.note.value)||'';
      rows('debts').filter(function(d){return d.partyType==='customer'&&(String(d.partyId||'')===String(id)||String(d.partyName||'')===String(c.name))&&num(d.remaining!==undefined?d.remaining:(num(d.amount)-num(d.paid)))>0}).forEach(function(d){if(remaining<=0)return; var rem=num(d.remaining!==undefined?d.remaining:(num(d.amount)-num(d.paid))); var take=Math.min(rem,remaining); d.paid=num(d.paid)+take; d.remaining=Math.max(0,rem-take); d.status=d.remaining<=0?'مدفوع':'جزئي'; remaining-=take;});
      rows('sales').filter(function(s){return (String(s.customerId||'')===String(id)||String(s.customerName||'')===String(c.name))&&num(s.due)>0}).forEach(function(s){if(remaining<=0)return; var take=Math.min(num(s.due),remaining); s.paid=num(s.paid)+take; s.due=Math.max(0,num(s.due)-take); s.paymentStatus=s.due<=0?'مدفوع':'جزئي'; remaining-=take;});
      arr('debtPayments').unshift({id:uid('pay'),date:nowText(),partyType:'customer',partyId:id,partyName:c.name||'',amount:amount,accountId:account,note:note});
      addMovement(account,'in',amount,'سداد دين '+(c.name||''),note); persist(); toast('تم تسجيل دفعة السداد'); window.openCustomerLedger(id);
    };
  }

  document.addEventListener('click', function(ev){
    var close = ev.target.closest && ev.target.closest('[data-oskar-close],.oskar-close-btn');
    if(close){ev.preventDefault(); ev.stopPropagation(); closeAllModals(); return;}
    var b = ev.target.closest && ev.target.closest('[data-r27-action]');
    if(!b) return;
    ev.preventDefault(); ev.stopPropagation();
    var act=b.getAttribute('data-r27-action'), id=b.getAttribute('data-id')||'';
    if(act==='manualDebt') return window.openManualDebtForCustomer(id);
    if(act==='quickPay') return window.openQuickDebtPayment(id);
    if(act==='saveManualDebt') return window.saveManualDebt();
    if(act==='saveQuickPay') return window.saveQuickCustomerPayment(id);
    if(act==='ledger') return window.openCustomerLedger(id);
  }, true);

  document.addEventListener('pointerdown', function(ev){
    var handle = ev.target.closest && ev.target.closest('[data-oskar-drag],.modal-head,.smart-modal-head');
    if(!handle || (ev.target.closest && ev.target.closest('button,a,input,select,textarea'))) return;
    var modal = ev.target.closest('.modal,.smart-modal'); if(!modal) return;
    var startY=ev.clientY, dy=0;
    modal.classList.add('oskar-sheet-dragging');
    function move(e){dy=Math.max(0,e.clientY-startY); modal.style.transform='translateY('+dy+'px)'; if(dy>6)e.preventDefault();}
    function up(){document.removeEventListener('pointermove',move); document.removeEventListener('pointerup',up); modal.classList.remove('oskar-sheet-dragging'); if(dy>110){modal.style.transform='translateY(110%)'; setTimeout(closeAllModals,110);} else modal.style.transform='';}
    document.addEventListener('pointermove',move,{passive:false}); document.addEventListener('pointerup',up,{once:true});
  }, true);

  function applyAll(){installStyle(); markFieldLayouts(document); setupModals(document); installCustomerFixes();}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', applyAll, {once:true}); else applyAll();
  [120,450,1000,2200].forEach(function(t){setTimeout(applyAll,t)});
  try{new MutationObserver(function(){clearTimeout(window.__oskarR27mo); window.__oskarR27mo=setTimeout(applyAll,70)}).observe(document.documentElement,{childList:true,subtree:true})}catch(e){}
})();
