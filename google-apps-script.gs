/* ============================================================
   CPAC → Google Sheet  (Google Apps Script)
   ------------------------------------------------------------
   วิธีติดตั้ง / อัปเดต:
   1) เปิด Google Sheet → ส่วนขยาย (Extensions) → Apps Script
   2) ลบโค้ดเดิมทั้งหมด แล้ววางโค้ดนี้ทั้งหมด → บันทึก (รูปแผ่นดิสก์)
   3) Deploy → Manage deployments → ไอคอนดินสอ ✏️ → Version: New version → Deploy
      (สำคัญ: ต้องเลือก "New version" ไม่ใช่ deploy เดิม ไม่งั้นโค้ดใหม่จะไม่มีผล)
   4) ลิงก์ /exec เดิมใช้ได้เลย ไม่ต้องเปลี่ยนในเว็บ
   ------------------------------------------------------------
   ทำ 2 อย่าง:
   - doPost  = รับข้อมูลจากฟอร์ม แล้วเติมแถวใหม่ในชีต (+ อัปโหลดรูปขึ้น Drive)
   - doGet   = ?action=list  ส่งข้อมูลทุกแถวกลับเป็น JSON ให้เว็บดึงไปซิงก์
   ============================================================ */

var PHOTO_FOLDER_NAME = 'CPAC รูปหน่วยงาน';

function getOrCreatePhotoFolder(){
  var it = DriveApp.getFoldersByName(PHOTO_FOLDER_NAME);
  if(it.hasNext()) return it.next();
  return DriveApp.createFolder(PHOTO_FOLDER_NAME);
}

function uploadPhotosToDrive(photos, baseName){
  if(!photos || !photos.length) return '';
  var folder = getOrCreatePhotoFolder();
  var links = [];
  for(var i=0;i<photos.length && i<5;i++){
    try{
      var dataUrl = String(photos[i]);
      var m = dataUrl.match(/^data:(image\/[a-zA-Z]+);base64,(.+)$/);
      if(!m) continue;
      var mime = m[1];
      var bytes = Utilities.base64Decode(m[2]);
      var ext = mime.indexOf('png')>=0 ? 'png' : 'jpg';
      var fname = (baseName || 'site') + '_' + (i+1) + '_' + new Date().getTime() + '.' + ext;
      var blob = Utilities.newBlob(bytes, mime, fname);
      var file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      links.push(file.getUrl());
    }catch(err){}
  }
  return links.join('\n');
}

function doPost(e){
  try{
    var lock = LockService.getScriptLock();
    lock.waitLock(20000);

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    var data  = JSON.parse(e.postData.contents);

    var lastCol = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

    function norm(s){ return String(s == null ? '' : s).trim().toLowerCase(); }
    var incoming = {};
    Object.keys(data).forEach(function(k){ incoming[norm(k)] = data[k]; });

    if(data.photos && data.photos.length){
      var photoLinks = uploadPhotosToDrive(data.photos, data.photoName);
      incoming[norm('รูปภาพหน่วยงาน')] = photoLinks;
    }

    var row = headers.map(function(h){
      var key = norm(h);
      return (incoming[key] !== undefined && incoming[key] !== null) ? incoming[key] : '';
    });

    sheet.appendRow(row);
    lock.releaseLock();

    return ContentService
      .createTextOutput(JSON.stringify({ ok: true }))
      .setMimeType(ContentService.MimeType.JSON);
  }catch(err){
    return ContentService
      .createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/* ไล่ตาม redirect ของลิงก์ทีละจังหวะ (สูงสุด 6 ครั้ง) เพื่อหาพิกัด @lat,lng
   ที่ Google ฝังไว้ในลิงก์ปลายทาง — แม่นยำกว่าค้นในเนื้อหน้าเว็บ */
function resolveCoordsFromUrl(url){
  var current = url;
  for(var i=0;i<6;i++){
    var m = current.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
    if(m) return [parseFloat(m[1]), parseFloat(m[2])];
    var resp = UrlFetchApp.fetch(current, { followRedirects:false, muteHttpExceptions:true });
    var headers = resp.getAllHeaders();
    var loc = headers['Location'] || headers['location'];
    if(loc){ current = loc; continue; }
    var html = resp.getContentText();
    m = html.match(/@(-?\d{1,3}\.\d+),(-?\d{1,3}\.\d+)/);
    if(!m) m = html.match(/!3d(-?\d{1,3}\.\d+)!4d(-?\d{1,3}\.\d+)/);
    if(m) return [parseFloat(m[1]), parseFloat(m[2])];
    break;
  }
  return null;
}

/* ?action=list -> คืนทุกแถวในชีตเป็น JSON { rows: [...] }
   ?action=resolve&url=... -> แปลงลิงก์ Google Maps แบบสั้น (maps.app.goo.gl/...)
   ให้เป็นพิกัด lat/lng จริง (ทำที่นี่เพราะเบราว์เซอร์ตามลิงก์ข้ามโดเมนแบบนี้เองไม่ได้)
   ไม่ใส่ ?action หรือใส่ค่าอื่น -> เช็คสถานะเฉยๆ */
function doGet(e){
  var action = e && e.parameter && e.parameter.action;
  if(action === 'resolve'){
    var url = e.parameter.url;
    try{
      var coords = resolveCoordsFromUrl(url);
      if(coords){
        return ContentService.createTextOutput(JSON.stringify({ ok:true, lat:coords[0], lng:coords[1] }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      return ContentService.createTextOutput(JSON.stringify({ ok:false, error:'ไม่พบพิกัดในลิงก์นี้' }))
        .setMimeType(ContentService.MimeType.JSON);
    }catch(err){
      return ContentService.createTextOutput(JSON.stringify({ ok:false, error:String(err) }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  if(action === 'list'){
    try{
      var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
      var lastRow = sheet.getLastRow();
      var lastCol = sheet.getLastColumn();
      if(lastRow < 2){
        return ContentService.createTextOutput(JSON.stringify({ ok:true, rows: [] }))
          .setMimeType(ContentService.MimeType.JSON);
      }
      var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      var values  = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
      var rows = values.map(function(r){
        var obj = {};
        headers.forEach(function(h, i){ obj[h] = r[i]; });
        return obj;
      });
      return ContentService.createTextOutput(JSON.stringify({ ok:true, rows: rows }))
        .setMimeType(ContentService.MimeType.JSON);
    }catch(err){
      return ContentService.createTextOutput(JSON.stringify({ ok:false, error:String(err) }))
        .setMimeType(ContentService.MimeType.JSON);
    }
  }
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, msg: 'CPAC endpoint พร้อมใช้งาน' }))
    .setMimeType(ContentService.MimeType.JSON);
}
