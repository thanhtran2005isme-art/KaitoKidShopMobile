# KaitoKid backend - MariaDB/XAMPP setup

The local XAMPP installation reports MariaDB 10.4.32. The backend therefore uses Pomelo's EF Core provider for MariaDB/MySQL-compatible servers.

## Runtime stack

- App target framework: .NET 10
- EF Core: 8.0.31
- Provider: Pomelo.EntityFrameworkCore.MySql 8.0.3
- Local database server: MariaDB 10.4.32 (XAMPP)
- DbContext registration: `AddMariaDb<TContext>()`
- Pomelo server dialect: `MariaDbServerVersion(10.4.32)`

## 1. Start MariaDB in XAMPP

Open XAMPP Control Panel and start MySQL. XAMPP labels its MariaDB service as "MySQL".

Verify from CMD:

```bat
"C:\xampp\mysql\bin\mysql.exe" --version
```

## 2. Create the database and application user

Edit `Database/mysql-bootstrap.sql` and replace `CHANGE_ME` with a local password.

Then, from the repository root:

```bat
"C:\xampp\mysql\bin\mysql.exe" -u root < BACKEND\Database\mysql-bootstrap.sql
```

If the XAMPP root account has a password, use `-u root -p` instead.

Do not commit the real database password. The committed `appsettings.json` files intentionally keep `Password=CHANGE_ME`.

For CMD:

```bat
set "ConnectionStrings__DefaultConnection=Server=localhost;Port=3306;Database=KaitoKid;User=kaitokid;Password=YOUR_PASSWORD;CharSet=utf8mb4;"
```

For PowerShell:

```powershell
$env:ConnectionStrings__DefaultConnection="Server=localhost;Port=3306;Database=KaitoKid;User=kaitokid;Password=YOUR_PASSWORD;CharSet=utf8mb4;"
```

## 3. Legacy SQL Server migrations

The existing `API.Admin/Migrations`, `API.Auth/Migrations`, and `API.Customer/Migrations` folders were generated for SQL Server and contain SQL Server-specific metadata. They are intentionally excluded from compilation.

The existing older `Database/*.sql` files are also T-SQL history unless a file explicitly states that it targets MariaDB/MySQL.

Do not apply the SQL Server migrations/scripts directly to MariaDB.

## 4. Schema migration is a separate step

Changing the EF provider does not automatically convert the old SQL Server schema or data.

The three DbContexts overlap on multiple tables, so generating and applying three independent Initial migrations to the same empty database can create duplicate-table conflicts.

Build/review a single MariaDB baseline schema, or migrate the existing SQL Server schema/data, before considering the database conversion complete.
