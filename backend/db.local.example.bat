@echo off
rem Local MariaDB connection for KaitoKid backend.
rem Copy this file to db.local.bat and replace CHANGE_ME with your local password.
rem db.local.bat is gitignored and must never be committed.

set "ConnectionStrings__DefaultConnection=Server=localhost;Port=3306;Database=kaitokid;User=kaitokid;Password=CHANGE_ME;CharSet=utf8mb4;"
