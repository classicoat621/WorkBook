/* ============================================================
   CPAC → Google Sheet  (Google Apps Script)
   ------------------------------------------------------------
   วิธีติดตั้ง (ทำครั้งเดียว ~2 นาที):
   1) เปิด Google Sheet ที่ต้องการ (ไฟล์ "Wook book OSR")
   2) เมนู  ส่วนขยาย (Extensions) → Apps Script
   3) ลบโค้ดเดิมทิ้ง แล้ววางโค้ดนี้ทั้งหมด → บันทึก (รูปแผ่นดิสก์)
   4) กดปุ่ม  Deploy → New deployment
        - Select type:  Web app
        - Description:   CPAC form
        - Execute as:    Me (อีเมลคุณ)
        - Who has access: Anyone        ← สำคัญ ต้องเลือกอันนี้
        - กด Deploy → อนุญาตสิทธิ์ (Authorize)
   5) คัดลอก  "Web app URL"  ที่ลงท้ายด้วย /exec
        แล้วส่งให้ผม เพื่อนำไปวางในเว็บ
   ------------------------------------------------------------
   สคริปต์นี้จะ:
   - อ่าน "แถวหัวคอลัมน์" (แถวที่ 1) ของชีต
   - นำข้อมูลที่ส่งมา ไปลงคอลัมน์ที่ "ชื่อตรงกัน" เท่านั้น
   - คอลัมน์ที่ไม่มีข้อมูลตรงกัน จะเว้นว่างไว้
   - ถ้ามีรูปภาพแนบมาด้วย (payload.photos = dataURL[]) จะอัปโหลด
     ขึ้นโฟลเดอร์ Google Drive ชื่อ "CPAC รูปหน่วยงาน" ให้อัตโนมัติ
     แล้วนำลิงก์ที่ได้ไปแทนที่คอลัมน์ "รูปภาพหน่วยงาน"
   ============================================================ */

var PHOTO_FOLDER_NAME = 'CPAC รูปหน่วยงาน';

function getOrCreatePhotoFolder(){
  var it = DriveApp.getFoldersByName(PHOTO_FOLDER_NAME);
  if(it.hasNext()) return it.next();
  return DriveApp.createFolder(PHOTO_FOLDER_NAME);
}

/* อัปโหลดรูป (dataURL[]) ขึ้น Drive แล้วคืนลิงก์เปิดดูได้ (คั่นด้วยขึ้นบรรทัดใหม่) */
function uploadPhotosToDrive(photos, baseName){
  if(!photos || !photos.length) return '';
  var folder = getOrCreatePhotoFolder();
  var links = [];
  for(var i=0;i<photos.length && i<5;i++){   /* จำกัด 5 รูป/ครั้ง กัน timeout */
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
    }catch(err){ /* ข้ามรูปที่ผิดพลาด ไม่ให้ทั้งแถวพัง */ }
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

    /* ทำหัวคอลัมน์ให้เทียบง่าย (ตัดช่องว่าง + พิมพ์เล็ก) */
    function norm(s){ return String(s == null ? '' : s).trim().toLowerCase(); }
    var incoming = {};
    Object.keys(data).forEach(function(k){ incoming[norm(k)] = data[k]; });

    /* ถ้ามีรูปแนบมา -> ไม่ได้อัปโหลดขึ้น Drive แล้ว (ปิดฟีเจอร์นี้ไว้ชั่วคราว)
       แค่บอกจำนวนรูปที่แนบไว้ในคอลัมน์ "รูปภาพหน่วยงาน" */
    if(data.photos && data.photos.length){
      incoming[norm('รูปภาพหน่วยงาน')] = data.photos.length + ' รูป (แนบในเครื่อง)';
    }

    /* สร้างแถวใหม่ตามลำดับหัวคอลัมน์จริงในชีต */
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

/* ไว้ทดสอบว่า deploy สำเร็จ — เปิด Web app URL ในเบราว์เซอร์จะเห็น {"ok":true,"msg":"CPAC endpoint พร้อมใช้งาน"}
   ถ้าเรียกด้วย ?action=list จะคืนข้อมูลทุกแถวในชีตเป็น JSON (ใช้ให้เว็บดึงกลับมาแสดงบน Dashboard) */
function doGet(e){
  if(e && e.parameter && e.parameter.action === 'list'){
    return listRows();
  }
  return ContentService
    .createTextOutput(JSON.stringify({ ok: true, msg: 'CPAC endpoint พร้อมใช้งาน' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function listRows(){
  try{
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    var lastRow = sheet.getLastRow();
    var lastCol = sheet.getLastColumn();
    if(lastRow < 2){
      return ContentService.createTextOutput(JSON.stringify({ ok:true, rows:[] })).setMimeType(ContentService.MimeType.JSON);
    }
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var values  = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    var rows = values.map(function(r){
      var obj = {};
      headers.forEach(function(h, i){ obj[h] = r[i]; });
      return obj;
    });
    return ContentService.createTextOutput(JSON.stringify({ ok:true, rows:rows })).setMimeType(ContentService.MimeType.JSON);
  }catch(err){
    return ContentService.createTextOutput(JSON.stringify({ ok:false, error:String(err) })).setMimeType(ContentService.MimeType.JSON);
  }
}
