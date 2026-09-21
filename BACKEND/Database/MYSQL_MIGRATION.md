# KaitoKid backend - MariaDB/XAMPP setup

The local XAMPP installation reports MariaDB 10.4.32. The backend uses Pomelo's EF Core provider for MariaDB/MySQL-compatible servers.

## Recommended fresh import

For a clean database where old SQL Server data does not need to be preserved, use:

`Database/KaitoKid_MariaDB.sql`

This is the MariaDB 10.4 conversion of the legacy SQL Server master schema. It includes:

- the 46 unique tables from `KaitoKid_Database.sql`;
- all later column additions from the embedded SQL Server migration history;
- converted indexes and foreign keys;
- the original seed/sample INSERT statements;
- 5 current API.Auth/RBAC tables that exist in the backend models but were missing from the old master SQL: `VaiTro`, `QuyenHan`, `VaiTro_QuyenHan`, `NhanVien`, and `LichSuDangNhapNV`.

The script is a **clean rebuild** and starts with `DROP DATABASE IF EXISTS KaitoKid`. Do not use it on a database whose data must be kept.

From the repository root:

```bat
"C:\xampp\mysql\bin\mysql.exe" -u root < BACKEND\Database\KaitoKid_MariaDB.sql
```

If the XAMPP root account has a password:

```bat
"C:\xampp\mysql\bin\mysql.exe" -u root -p < BACKEND\Database\KaitoKid_MariaDB.sql
```

Verify the import:

```bat
"C:\xampp\mysql\bin\mysql.exe" -u root -e "SELECT COUNT(*) AS table_count FROM information_schema.tables WHERE table_schema='KaitoKid' AND table_type='BASE TABLE';"
```

The expected table count is **51**.

## Application database user

`mysql-bootstrap.sql` creates the `kaitokid` account and grants access to `KaitoKid.*`. Keep the real password out of Git.

For CMD, set the runtime connection string in the terminal before launching a backend API:

```bat
set "ConnectionStrings__DefaultConnection=Server=localhost;Port=3306;Database=KaitoKid;User=kaitokid;Password=YOUR_PASSWORD;CharSet=utf8mb4;"
```

For PowerShell:

```powershell
$env:ConnectionStrings__DefaultConnection="Server=localhost;Port=3306;Database=KaitoKid;User=kaitokid;Password=YOUR_PASSWORD;CharSet=utf8mb4;"
```

## Legacy SQL Server files

`KaitoKid_Database.sql` and the older `Database/*.sql` migration files remain in the repository as SQL Server/T-SQL history.

Do not execute them against MariaDB.

The legacy EF migration folders in `API.Admin/Migrations`, `API.Auth/Migrations`, and `API.Customer/Migrations` are also SQL Server migrations and remain excluded from compilation.

For the initial clean MariaDB setup, do **not** run the three independent `dotnet ef database update` commands. The three DbContexts overlap on several tables; use the consolidated `KaitoKid_MariaDB.sql` schema instead.

## Runtime stack

- App target framework: .NET 10
- EF Core: 8.0.31
- Provider: Pomelo.EntityFrameworkCore.MySql 8.0.3
- Local database server: MariaDB 10.4.32 (XAMPP)
- DbContext registration: `AddMariaDb<TContext>()`
- Pomelo server dialect: `MariaDbServerVersion(10.4.32)`
