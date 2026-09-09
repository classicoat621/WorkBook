#!/bin/bash
# ============================================================
#  CPAC work book — เปิดระบบแบบออฟไลน์ (Mac)
#  ดับเบิลคลิกไฟล์นี้ได้เลย (ถ้าเปิดไม่ได้ ดูวิธีในไฟล์ "วิธีใช้.txt")
# ============================================================
cd "$(dirname "$0")"

echo ""
echo "  ============================================"
echo "   CPAC work book - กำลังเปิดระบบ..."
echo "   อย่าปิดหน้าต่างนี้ขณะใช้งาน"
echo "  ============================================"
echo ""

# เปิดเบราว์เซอร์ไปที่หน้าระบบ (รอ 1 วินาทีให้เซิร์ฟเวอร์เริ่ม)
( sleep 1 && open "http://localhost:8765/index.html" ) &

# รันเว็บเซิร์ฟเวอร์ในโฟลเดอร์นี้
if command -v python3 >/dev/null 2>&1; then
  python3 -m http.server 8765
elif command -v python >/dev/null 2>&1; then
  python -m http.server 8765
else
  echo ""
  echo "  [!] ไม่พบ Python ในเครื่อง"
  echo "      Mac ส่วนใหญ่มีอยู่แล้ว — ลองเปิด Terminal พิมพ์: python3 --version"
  echo "      ถ้าไม่มี ติดตั้งจาก https://www.python.org/downloads/"
  echo ""
  read -n 1 -s -r -p "  กดปุ่มใดก็ได้เพื่อปิด..."
fi
