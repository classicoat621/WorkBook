/* ============================================================
   CPAC — โมดูลกลาง: ระบบล็อกอิน (จำลอง) + จัดการข้อมูล + ข้อมูลตัวอย่าง
   ใช้ร่วมกันทุกหน้า  ->  window.CPAC
   * ระบบล็อกอินนี้เป็นแบบ "จำลองในเครื่อง" (demo) ไม่ได้ต่อเซิร์ฟเวอร์จริง
   ============================================================ */
window.CPAC = (function(){

  /* ============================================================
     เชื่อมต่อ Google Sheet (ผ่าน Apps Script Web App)
     👉 วาง URL ที่ลงท้ายด้วย /exec ที่ได้จากการ Deploy ตรงนี้
        (ดูวิธีในไฟล์ google-apps-script.gs)
     ถ้าเว้นว่าง = ไม่ส่งขึ้นชีต (ใช้งานในเครื่องตามปกติ)
     ============================================================ */
  const SHEET_ENDPOINT = 'https://script.google.com/macros/s/AKfycbz9bJBUebvJQiSiA6pY2ALhOe-vCkOHEgxlP1QC6llc_i0MQ4SJ8iV22AcV2Z2t2cRO/exec';

  /* แม็พ: ชื่อคอลัมน์ในชีต  →  ค่าที่จะส่งจากแต่ละหน่วยงาน
     ⚠️ "คีย์" ทางซ้ายต้องสะกดให้ตรงกับหัวคอลัมน์ในชีต (เว้นวรรค/ตัวพิมพ์ไม่สำคัญ)
     ถ้าหัวคอลัมน์ในชีตของคุณใช้ชื่ออื่น แก้ฝั่งซ้ายให้ตรงได้เลย */
  const SHEET_MAP = {
    'Site code'            : e => e.code || '',
    'หน่วยงาน'              : e => e.site || '',
    'ผู้รับผิดชอบ'          : e => e.owner || '',
    'Metro'                : e => e.metro || '',
    'Cluster'              : e => e.cluster || '',
    'โรงงานจัดส่ง * (เลือก Cluster ก่อน)' : e => e.plant || '',
    'สถานะงาน'              : e => e.status || '',
    'ปริมาณคอนกรีตทั้งโครงการ' : e => e.projectVol || 0,
    'ปริมาณคอนกรีตเทต่อเดือน (ลบ.ม.) ' : e => e.vol || 0,
    'JAN': e => e.vol_JAN || 0, 'FEB': e => e.vol_FEB || 0, 'MAR': e => e.vol_MAR || 0,
    'APR': e => e.vol_APR || 0, 'MAY': e => e.vol_MAY || 0, 'JUN': e => e.vol_JUN || 0,
    'JUL': e => e.vol_JUL || 0, 'AUG': e => e.vol_AUG || 0, 'SEP': e => e.vol_SEP || 0,
    'OCT': e => e.vol_OCT || 0, 'NOV': e => e.vol_NOV || 0, 'DEC': e => e.vol_DEC || 0,
    'ระยะจัดส่ง'            : e => e.dist || 0,
    'ส่วนลด CPAC'           : e => e.disc || 0,
    'ส่วนลดคู่แข่ง'          : e => e.cdisc || 0,
    'คู่แข่ง (ถึง ผรม.)'     : e => e.competitor || '',
    'คู่แข่งเพิ่มเติม'        : e => (e.competitorsExtra||[]).map(c=>`${c.name} (${c.disc||0}%)`).join(', '),
    'คาดว่าจะใช้งาน'         : e => e.start || '',
    'วันที่ทราบข้อมูล'        : e => e.knownDate || '',
    'รายละเอียดโครงการ'      : e => e.projectDetail || '',
    'รายละเอียดเพิ่มเติม'     : e => e.detail || '',
    'แผนที่หน่วยงาน'         : e => e.mapUrl || '',
    'รูปภาพหน่วยงาน'         : e => '',   /* เติมทีหลังจากผลอัปโหลดขึ้น Drive (ดู pushToSheet) */
    'สาเหตุที่ขายไม่ได้'      : e => e.reason || '',
    'ผรม. (ผู้รับเหมา)'       : e => e.contractor || '',
    'เบอร์ติดต่อลูกค้า'       : e => e.customerPhone || '',
  };

  /* แม็พย้อนกลับ: หัวคอลัมน์ในชีต  →  ชื่อฟิลด์ภายใน (สำหรับอ่านกลับเข้ามาเป็น entry) */
  const NUM_FIELDS = ['ปริมาณคอนกรีตทั้งโครงการ','ปริมาณคอนกรีตเทต่อเดือน (ลบ.ม.) ','JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC','ระยะจัดส่ง','ส่วนลด CPAC','ส่วนลดคู่แข่ง'];
  const SHEET_FIELD = {
    'Site code':'code', 'หน่วยงาน':'site', 'ผู้รับผิดชอบ':'owner', 'Metro':'metro', 'Cluster':'cluster',
    'โรงงานจัดส่ง * (เลือก Cluster ก่อน)':'plant', 'สถานะงาน':'status',
    'ปริมาณคอนกรีตทั้งโครงการ':'projectVol', 'ปริมาณคอนกรีตเทต่อเดือน (ลบ.ม.) ':'vol',
    'JAN':'vol_JAN','FEB':'vol_FEB','MAR':'vol_MAR','APR':'vol_APR','MAY':'vol_MAY','JUN':'vol_JUN',
    'JUL':'vol_JUL','AUG':'vol_AUG','SEP':'vol_SEP','OCT':'vol_OCT','NOV':'vol_NOV','DEC':'vol_DEC',
    'ระยะจัดส่ง':'dist', 'ส่วนลด CPAC':'disc', 'ส่วนลดคู่แข่ง':'cdisc', 'คู่แข่ง (ถึง ผรม.)':'competitor',
    'คาดว่าจะใช้งาน':'start', 'วันที่ทราบข้อมูล':'knownDate', 'รายละเอียดโครงการ':'projectDetail',
    'รายละเอียดเพิ่มเติม':'detail', 'แผนที่หน่วยงาน':'mapUrl', 'รูปภาพหน่วยงาน':'photosRaw',
    'สาเหตุที่ขายไม่ได้':'reason', 'ผรม. (ผู้รับเหมา)':'contractor', 'เบอร์ติดต่อลูกค้า':'customerPhone',
  };

  /* ดูงข้อมูลกลับจาก Google Sheet ที่ตน (?action=list) — ให้ทุกเครื่อง/ทุกคนเห็นข้อมูลเดียวกัน */
  function fetchSheetEntries(){
    if(!SHEET_ENDPOINT) return Promise.resolve([]);
    /* ชื่อเต็ม -> username (สำหรับ 6 บัญชีที่ลงทะเบียนไว้ล่วงหน้า) */
    const nameToKey = {};
    Object.keys(USERS).forEach(k=>{ nameToKey[USERS[k].name] = k; });
    return fetch(SHEET_ENDPOINT + '?action=list')
      .then(r=> r.json())
      .then(data=>{
        const rows = (data && data.rows) || [];
        return rows.map((row,i)=>{
          const e = { _fromSheet:true, ts: 1780000000000 + i };
          Object.keys(row).forEach(h=>{
            const key = SHEET_FIELD[h]; if(!key) return;
            let v = row[h];
            if(NUM_FIELDS.indexOf(h)>=0) v = Number(v)||0;
            e[key] = v;
          });
          /* หาว่าแถวนี้เป็นของใคร: เทียบชื่อเจ้าของงานกับบัญชีที่รู้จัก
             ถ้าไม่รู้จัก (บัญชีพิมพ์เองแบบ ad-hoc) ใช้ชื่อเจ้าของงานเป็น username ตรงๆ */
          const ownerName = String(e.owner||'').trim();
          e.user = nameToKey[ownerName] || ownerName.toLowerCase();
          e.photos = e.photosRaw ? String(e.photosRaw).split('\n').filter(Boolean) : [];
          e._id = 'sheet'+i;
          return e;
        }).filter(e=> e.site);   /* ตัดแทวเปล่าที่ไม่มีชื่อหน่วยงานออก */
      })
      .catch(()=>[]);
  }

  /* ผสานข้อมูลจาก Google Sheet เข้ากับ localStorage ในเครื่อง
     (ให้ทุกอุปกรณ์/เบราว์เซอร์เห็นข้อมูลที่คนอื่นกรอกไว้ด้วย) */
  function syncFromSheet(){
    if(!SHEET_ENDPOINT) return Promise.resolve(false);
    return fetchSheetEntries().then(rows=>{
      if(!rows.length) return false;
      const local = entries();
      /* กันซ้ำด้วย Site code + ชื่อหน่วยงาน (ไม่รวม user — กันเผื่อชื่อผู้ใช้เพี้ยนคนละรูปแบบ) */
      const localKeys = new Set(local.filter(e=>!e._fromSheet).map(e=> (e.code||'')+'|'+(e.site||'')));
      const sheetKeys = new Set(local.filter(e=>e._fromSheet).map(e=> (e.code||'')+'|'+(e.site||'')));
      let changed = false;
      /* ลบของเก่าที่มาจากชีต แล้วแทนด้วยชุดล่าสุดทั้งหมด (เพื่อให้แก้ไข/ลบที่ชีตสะท้อนผลด้วย) */
      const keptLocal = local.filter(e=> !e._fromSheet);
      const merged = keptLocal.slice();
      rows.forEach(r=>{
        const key = (r.code||'')+'|'+(r.site||'');
        if(r.site && !localKeys.has(key)){ merged.push(r); changed = true; }
      });
      if(sheetKeys.size !== rows.length) changed = true;   /* จำนวนจากชีตเปลี่ยนไป (เพิ่ม/ลบ) */
      if(changed) saveEntries(merged);
      return changed;
    }).catch(()=>false);
  }

  /* ส่งหน่วยงาน 1 รายการขึ้น Google Sheet (ทำงานแบบ fire-and-forget)
     รูปภาพ (ถ้ามี) จะถูกส่งแนบไปด้วย — ฝั่ง Apps Script จะอัปโหลดขึ้น Google Drive
     แล้วนำลิงก์มาใส่ในคอลัมน์ "รูปภาพหน่วยงาน" ให้เอง */
  function pushToSheet(entry){
    if(!SHEET_ENDPOINT) return Promise.resolve(false);
    const payload = {};
    Object.keys(SHEET_MAP).forEach(col=>{ try{ payload[col] = SHEET_MAP[col](entry); }catch(e){ payload[col] = ''; } });
    if(entry.photos && entry.photos.length){
      payload.photos = entry.photos;   /* dataURL[] — ไม่เกิน ~5 รูป/ครั้ง เพื่อไม่ให้ payload ใหญ่เกินไป */
      payload.photoName = (entry.code || entry.site || 'site');
    }
    return fetch(SHEET_ENDPOINT, {
      method: 'POST',
      mode: 'no-cors',                       /* เลี่ยง CORS — ส่งได้ แต่จะอ่าน response ไม่ได้ (ปกติ) */
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
    }).then(()=>true).catch(()=>false);
  }

  /* ---------- บัญชีผู้ใช้ (DEMO) — แก้ user/password ได้ที่นี่ ---------- */
  /* ---------- บัญชีผู้ใช้ (DEMO) ----------
     พนักงานขาย (staff): เห็น/แก้ไขได้เฉพาะงานของตัวเอง
     ผู้ดูแล (admin): เข้า Dashboard เห็นข้อมูลทั้งหมด */
  const USERS = {
    /* — พนักงานขาย — */
    'u':       { pass:'1234', name:'ทศพร (ยู)',     role:'staff', team:'Metro 1' },
    'nan':     { pass:'1234', name:'กรรณมณ (แนน)',  role:'staff', team:'Metro 2' },
    'taeng':   { pass:'1234', name:'ไปรมา (แตง)',   role:'staff', team:'Metro 3' },
    /* — ผู้ดูแลระบบ — */
    'amarin':  { pass:'1234', name:'อัมรินทร์',      role:'admin', team:'สำนักงานใหญ่' },
    'sinchai': { pass:'1234', name:'สินชัย',        role:'admin', team:'สำนักงานใหญ่' },
    'sutharat':{ pass:'1234', name:'สุธารัตน์',      role:'admin', team:'สำนักงานใหญ่' },
  };

  const SKEY = 'cpac_session';

  /* ---------- ล็อกอิน / เซสชัน ---------- */
  function login(u, p){
    const key = (u||'').trim().toLowerCase();
    const acc = USERS[key];
    if(acc && acc.pass === p){
      const sess = { username:key, name:acc.name, role:acc.role, team:acc.team };
      try{ localStorage.setItem(SKEY, JSON.stringify(sess)); }catch(e){}
      return sess;
    }
    return null;
  }
  /* เข้าสู่ระบบด้วยชื่อผู้ใช้อย่างเดียว ไม่ต้องกรอกรหัสผ่าน (ใช้ฝั่ง Staff)
     — รับได้ทุกชื่อ ไม่จำกัดแค่บัญชีที่ตั้งไว้ล่วงหน้า */
  function loginByUsername(u){
    const raw = (u||'').trim();
    if(!raw) return null;
    const key = raw.toLowerCase();
    const acc = USERS[key];
    const sess = acc
      ? { username:key, name:acc.name, role:'staff', team:acc.team }
      : { username:key, name:raw, role:'staff', team:'ทั่วไป' };   /* ผู้ใช้ใหม่ที่ไม่ได้ลงทะเบียนไว้ล่วงหน้า */
    try{ localStorage.setItem(SKEY, JSON.stringify(sess)); }catch(e){}
    return sess;
  }
  function session(){
    try{ return JSON.parse(localStorage.getItem(SKEY) || 'null'); }catch(e){ return null; }
  }
  function logout(){ try{ localStorage.removeItem(SKEY); }catch(e){} }
  /* กั้นหน้า: ถ้าไม่ได้ล็อกอินตาม role ที่ต้องการ -> เด้งไปหน้า login */
  function requireRole(role, loginPage){
    const s = session();
    if(!s || (role && s.role !== role)){ location.replace(loginPage); return null; }
    return s;
  }
  function initials(name){
    if(!name) return '?';
    const p = name.trim().split(/\s+/);
    return (p[0]||'').slice(0,1) + (p[1]||'').slice(0,1) || name.slice(0,1);
  }

  /* ---------- ข้อมูลหน่วยงาน (เก็บใน localStorage: cpac_entries) ---------- */
  function entries(){
    try{ return JSON.parse(localStorage.getItem('cpac_entries') || '[]'); }catch(e){ return []; }
  }
  function saveEntries(arr){
    try{ localStorage.setItem('cpac_entries', JSON.stringify(arr)); }catch(e){}
  }
  function myEntries(user){
    return entries().filter(e=> e.user === user).sort((a,b)=>(b.ts||0)-(a.ts||0));
  }
  function findEntry(ts){ return entries().find(e=> String(e.ts) === String(ts)); }
  function updateEntry(ts, changes){
    const arr = entries();
    const r = arr.find(e=> String(e.ts) === String(ts));
    if(r){ Object.assign(r, changes); saveEntries(arr); }
    return r;
  }
  function deleteEntry(ts){
    saveEntries(entries().filter(e=> String(e.ts) !== String(ts)));
  }

  /* ---------- ข้อมูลตัวอย่าง (DEMO) — ใส่ครั้งเดียว ---------- */
  const SEED_VERSION = '8';
  function seed(){
    if(localStorage.getItem('cpac_seeded') === SEED_VERSION) return;
    let arr = entries().filter(e=> !e._seed);   /* เอา seed เก่าออกก่อน เผื่อมีการอัปเดต */
    const t0 = 1717000000000;                    /* ฐานเวลา (ให้ id คงที่) */
    const D = [
      // ----- สมชาย (somchai) -----
      { user:'u', owner:'ทศพร (ยู)', site:'โครงการ ลุมพินี พระราม 9', code:'S-2041', metro:'Metro 1', cluster:'พระราม 9', plant:'บางจาก', dist:12.4, vol:8600, status:'Win',    competitor:'INSEE',  reason:'',        disc:5.0, cdisc:3.0, start:'2026-08', _m:[5,4], map:1, mapUrl:'https://www.google.com/maps/search/?api=1&query=13.7563,100.5018', knownDate:'2026-05-12' },
      { user:'u', owner:'ทศพร (ยู)', site:'คอนโด ไอดีโอ สุขุมวิท',    code:'S-2055', metro:'Metro 1', cluster:'พระราม 4', plant:'บ่อนไก่',  dist:6.3,  vol:11200, status:'Win',    competitor:'TPI',    reason:'',        disc:6.0, cdisc:4.0, start:'2026-10', _m:[7,4], map:1, mapUrl:'https://www.google.com/maps/search/?api=1&query=13.7211,100.5640', knownDate:'2026-05-20' },
      { user:'u', owner:'ทศพร (ยู)', site:'อาคารสำนักงาน รัชดา',      code:'S-2068', metro:'Metro 1', cluster:'บางซื่อ',  plant:'รัชวิภา',  dist:8.1,  vol:5400,  status:'Follow', competitor:'',       reason:'เครดิต',   disc:4.5, cdisc:2.5, start:'2026-09', _m:[6,4], map:1, mapUrl:'https://www.google.com/maps/search/?api=1&query=13.7900,100.5700', knownDate:'2026-06-01' },
      { user:'nan', owner:'กรรณมณ (แนน)', site:'หมู่บ้าน เดอะคิวบ์ บางนา', code:'S-2073', metro:'Metro 3', cluster:'บางนา',   plant:'บางนา กม.4', dist:21.7, vol:3200, status:'Loss',  competitor:'INSEE',  reason:'ราคา',     disc:3.0, cdisc:7.0, start:'2026-09', _m:[6,3], map:1, mapUrl:'https://www.google.com/maps/search/?api=1&query=13.6680,100.6050', knownDate:'2026-05-28' },
      { user:'nan', owner:'กรรณมณ (แนน)', site:'โครงการ บ้านกลางเมือง',    code:'S-2090', metro:'Metro 1', cluster:'พระราม 4', plant:'พระราม 4/3', dist:11.0, vol:5100, status:'Follow', competitor:'',       reason:'ระยะทาง',  disc:4.0, cdisc:4.5, start:'2026-12', _m:[9,3], map:1, mapUrl:'https://www.google.com/maps/search/?api=1&query=13.7250,100.5450', knownDate:'2026-06-08' },
      { user:'nan', owner:'กรรณมณ (แนน)', site:'คอนโด เดอะ ไลน์ จตุจักร',  code:'S-2104', metro:'Metro 1', cluster:'บางซื่อ',  plant:'บางซ่อน',  dist:9.2,  vol:9300,  status:'Win',    competitor:'น่ำเฮง', reason:'',        disc:5.0, cdisc:3.0, start:'2026-09', _m:[5,4], map:1, mapUrl:'https://www.google.com/maps/search/?api=1&query=13.8000,100.5530', knownDate:'2026-06-15' },
      // ----- สุดา (suda) -----
      { user:'taeng', owner:'ไปรมา (แตง)', site:'ถนนเลี่ยงเมือง นนทบุรี', code:'S-2112', metro:'Metro 2', cluster:'บางบัวทอง', plant:'บางบัวทอง', dist:15.9, vol:6700, status:'Win',    competitor:'INSEE', reason:'',       disc:4.0, cdisc:3.5, start:'2026-08', _m:[5,4], map:1, mapUrl:'https://www.google.com/maps/search/?api=1&query=13.9100,100.4100', knownDate:'2026-05-30' },
      { user:'taeng', owner:'ไปรมา (แตง)', site:'มหาวิทยาลัย รังสิต',     code:'S-2126', metro:'Metro 2', cluster:'รังสิต',     plant:'รังสิต',    dist:27.3, vol:4600, status:'Follow', competitor:'',      reason:'เครดิต', disc:4.5, cdisc:5.5, start:'2027-01', _m:[8,4], map:1, mapUrl:'https://www.google.com/maps/search/?api=1&query=14.0200,100.7200', knownDate:'2026-06-10' },
    ];
    D.forEach((d,i)=>{
      d._seed = true; d.ts = t0 + i*86400000;
      /* ข้อมูลตัวอย่าง: รายละเอียดโครงการ + รายละเอียดเพิ่มเติม (ถ้ายังไม่มี) */
      if(!d.projectDetail){
        d.projectDetail = `งานโครงสร้าง ${d.site} · ปริมาณคอนกรีตรวมประมาณ ${d.vol.toLocaleString('th-TH')} ลบ.ม. จัดส่งจากโรงงาน ${d.plant} ระยะ ${d.dist} กม.`;
      }
      if(!d.detail){
        d.detail = d.status==='Win'
          ? 'ลูกค้ายืนยันใช้ CPAC · นัดหมายส่งงวดแรกตามแผน'
          : d.status==='Follow'
            ? ('อยู่ระหว่างติดตาม · ติดเรื่อง' + (d.reason||'เงื่อนไข') + ' · นัดติดตามอีกครั้ง')
            : ('ปิดงานไม่ได้ · แพ้ให้ ' + (d.competitor||'คู่แข่ง') + ' จากปัจจัยด้าน' + (d.reason||'ราคา'));
      }
      /* กระจายปริมาณรวมออกเป็นรายเดือน (vol_JAN..vol_DEC)
         👉 เริ่มจากเดือนที่ "คาดว่าจะเริ่มใช้" (start) เสมอ */
      if(d._m){
        const span = d._m[1];
        const st = (d.start && /^\d{4}-\d{2}$/.test(d.start)) ? (parseInt(d.start.split('-')[1],10)-1) : d._m[0];
        const base = Math.round(d.vol/span/100)*100; let acc = 0;
        for(let k=0;k<span;k++){ const mi=st+k; if(mi>11) break; const v=(k===span-1)?(d.vol-acc):base; acc+=v; d['vol_'+MONTH_KEYS[mi]]=v; }
        delete d._m;
      }
      if(!d.projectVol){ d.projectVol = Math.round(d.vol * 1.5 / 100) * 100; }
      arr.push(d);
    });
    saveEntries(arr);
    try{ localStorage.setItem('cpac_seeded', SEED_VERSION); }catch(e){}
  }

  /* ---------- ตัวช่วยจัดรูปแบบ ---------- */
  const MONTH_KEYS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  const TH_MONTHS = ['ม.ค.','ก.พ.','มี.ค.','เม.ย.','พ.ค.','มิ.ย.','ก.ค.','ส.ค.','ก.ย.','ต.ค.','พ.ย.','ธ.ค.'];
  const STATUS_TH = { Win:'Win', Loss:'Loss', Follow:'Follow' };
  function fmt(n){ return (Number(n)||0).toLocaleString('th-TH'); }
  function startTxt(s){ const [y,m] = (s||'').split('-'); return y ? `${TH_MONTHS[+m-1]} ${y}` : '—'; }
  /* ดัชนีเดือน (0-11) จากสตริง YYYY-MM(-DD) */
  function monthIdx(s){ if(s && /^\d{4}-\d{2}/.test(String(s))){ const m=parseInt(String(s).split('-')[1],10); return (m>=1&&m<=12)?m-1:-1; } return -1; }
  function monthKnown(d){ return monthIdx(d.knownDate); }   /* ตามวันที่ทราบข้อมูล */
  function monthStart(d){ return monthIdx(d.start); }      /* ตามวันที่คาดว่าจะเท */
  /* เดือนสำหรับกราฟสรุป Win/Loss/Follow: Win=วันที่คาดว่าจะเท, Loss/Follow=วันที่ทราบข้อมูล */
  function statusMonth(d){ return d.status==='Win' ? monthStart(d) : monthKnown(d); }
  function dateTxt(ts){
    if(!ts) return '—';
    const d = new Date(ts);
    return `${d.getDate()} ${TH_MONTHS[d.getMonth()]} ${d.getFullYear()+543}`;
  }

  /* ---------- อ่านพิกัดจากข้อความ (DMS / ทศนิยม / ลิงก์ Google Maps) ---------- */
  function parseLatLng(input){
    if(!input) return null;
    const s = String(input).trim();
    /* DMS: 13°46'32.4"N 100°31'39.2"E */
    const dms = s.match(/(\d{1,3})[°\s]+(\d{1,2})['\u2032\s]+([\d.]+)["\u2033\s]*([NSns])[,\s]+(\d{1,3})[°\s]+(\d{1,2})['\u2032\s]+([\d.]+)["\u2033\s]*([EWew])/);
    if(dms){
      let la=(+dms[1])+(+dms[2])/60+(+dms[3])/3600; if(/[Ss]/.test(dms[4])) la=-la;
      let lo=(+dms[5])+(+dms[6])/60+(+dms[7])/3600; if(/[Ww]/.test(dms[8])) lo=-lo;
      return [la,lo];
    }
    let m = s.match(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/);                 if(m) return [+m[1],+m[2]];
    m = s.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);                          if(m) return [+m[1],+m[2]];
    m = s.match(/[?&](?:q|query|ll|sll|daddr|destination|center)=(-?\d{1,3}\.\d+),\s*(-?\d{1,3}\.\d+)/i); if(m) return [+m[1],+m[2]];
    m = s.match(/\/(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);                         if(m) return [+m[1],+m[2]];
    m = s.match(/(-?\d{1,2}\.\d{3,})[, ]+(-?\d{2,3}\.\d{3,})/);                  if(m) return [+m[1],+m[2]];
    return null;
  }

  /* ---------- ย่อรูปเป็น dataURL (JPEG) — กัน localStorage เต็ม ---------- */
  function fileToThumb(file, maxPx, quality){
    maxPx = maxPx || 1000; quality = quality || 0.72;
    return new Promise((resolve)=>{
      const fr = new FileReader();
      fr.onload = ()=>{
        const img = new Image();
        img.onload = ()=>{
          let { width:w, height:h } = img;
          if(w>h && w>maxPx){ h = Math.round(h*maxPx/w); w = maxPx; }
          else if(h>=w && h>maxPx){ w = Math.round(w*maxPx/h); h = maxPx; }
          const cv = document.createElement('canvas'); cv.width=w; cv.height=h;
          cv.getContext('2d').drawImage(img, 0, 0, w, h);
          try{ resolve(cv.toDataURL('image/jpeg', quality)); }catch(e){ resolve(null); }
        };
        img.onerror = ()=> resolve(null);
        img.src = fr.result;
      };
      fr.onerror = ()=> resolve(null);
      fr.readAsDataURL(file);
    });
  }

  /* ---------- Lightbox ดูรูป (ใช้ได้ทุกหน้า) ---------- */
  function lightbox(photos, startIdx){
    if(!photos || !photos.length) return;
    let i = startIdx || 0;
    let ov = document.getElementById('cpac-lightbox');
    if(!ov){
      ov = document.createElement('div'); ov.id = 'cpac-lightbox';
      ov.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(10,20,28,.92);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;';
      ov.innerHTML =
        '<button id="clb-x" style="position:absolute;top:16px;right:18px;width:42px;height:42px;border:none;border-radius:50%;background:rgba(255,255,255,.15);color:#fff;font-size:20px;cursor:pointer;">✕</button>'+
        '<button id="clb-prev" style="position:absolute;left:14px;top:50%;transform:translateY(-50%);width:46px;height:46px;border:none;border-radius:50%;background:rgba(255,255,255,.15);color:#fff;font-size:22px;cursor:pointer;">‹</button>'+
        '<img id="clb-img" style="max-width:92%;max-height:80vh;border-radius:12px;box-shadow:0 16px 50px rgba(0,0,0,.5);object-fit:contain;" />'+
        '<button id="clb-next" style="position:absolute;right:14px;top:50%;transform:translateY(-50%);width:46px;height:46px;border:none;border-radius:50%;background:rgba(255,255,255,.15);color:#fff;font-size:22px;cursor:pointer;">›</button>'+
        '<div id="clb-count" style="margin-top:16px;color:#fff;font-size:14px;font-family:inherit;opacity:.85;"></div>';
      document.body.appendChild(ov);
    }
    const imgEl = ov.querySelector('#clb-img'), cnt = ov.querySelector('#clb-count');
    const prevB = ov.querySelector('#clb-prev'), nextB = ov.querySelector('#clb-next');
    function show(){ imgEl.src = photos[i]; cnt.textContent = (i+1)+' / '+photos.length; const multi = photos.length>1; prevB.style.display = nextB.style.display = multi ? 'block':'none'; }
    function close(){ ov.style.display='none'; }
    ov.style.display = 'flex';
    prevB.onclick = (e)=>{ e.stopPropagation(); i=(i-1+photos.length)%photos.length; show(); };
    nextB.onclick = (e)=>{ e.stopPropagation(); i=(i+1)%photos.length; show(); };
    ov.querySelector('#clb-x').onclick = close;
    ov.onclick = (e)=>{ if(e.target===ov) close(); };
    show();
  }

  return {
    USERS, login, loginByUsername, session, logout, requireRole, initials,
    entries, saveEntries, myEntries, findEntry, updateEntry, deleteEntry, seed,
    fmt, startTxt, dateTxt, MONTH_KEYS, TH_MONTHS, STATUS_TH,
    monthIdx, monthKnown, monthStart, statusMonth, parseLatLng,
    fileToThumb, lightbox,
    pushToSheet, SHEET_ENDPOINT, fetchSheetEntries, syncFromSheet,
  };
})();
