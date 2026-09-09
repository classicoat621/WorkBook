@echo off
REM ============================================================
REM  CPAC work book — เปิดระบบ (ไม่ต้องใช้ Python)
REM  ดับเบิลคลิกไฟล์นี้ได้เลย
REM ============================================================
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -NoProfile -File "%~dp0server.ps1"
