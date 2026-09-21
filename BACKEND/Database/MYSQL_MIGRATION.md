# KaitoKid backend - MySQL setup

The ASP.NET Core backend now uses MySQL through `MySql.EntityFrameworkCore`.

## 1. Create the database and application user

Run `mysql-bootstrap.sql` with an administrative MySQL account. Change the placeholder password before using it.

The committed `appsettings.json` files contain `Password=CHANGE_ME` intentionally. Prefer overriding the connection string with an environment variable instead of committing a real password.

PowerShell example:

```powershell
$env:ConnectionStrings__DefaultConnection="Server=localhost;Port=3306;Database=KaitoKid;User=kaitokid;Password=YOUR_PASSWORD;"
```

ASP.NET Core maps `ConnectionStrings__DefaultConnection` to `ConnectionStrings:DefaultConnection`.

## 2. Legacy SQL Server migrations

The existing `API.Admin/Migrations`, `API.Auth/Migrations`, and `API.Customer/Migrations` folders were generated for SQL Server. They contain SQL Server-specific metadata and are now excluded from compilation.

Do not apply those migrations to MySQL.

The existing `Database/*.sql` files are also SQL Server/T-SQL history unless their filename explicitly says MySQL.

## 3. Generate fresh MySQL migrations

From the `BACKEND` directory, after setting the MySQL connection string:

```powershell
dotnet restore

dotnet ef migrations add InitialMySql --project API.Auth --startup-project API.Auth --output-dir MigrationsMySql
dotnet ef database update --project API.Auth --startup-project API.Auth

dotnet ef migrations add InitialMySql --project API.Customer --startup-project API.Customer --output-dir MigrationsMySql
dotnet ef database update --project API.Customer --startup-project API.Customer

dotnet ef migrations add InitialMySql --project API.Admin --startup-project API.Admin --output-dir MigrationsMySql
dotnet ef database update --project API.Admin --startup-project API.Admin
```

All three DbContexts point at the same `KaitoKid` database. Review the generated migrations before applying them because the contexts overlap on several tables.

## 4. Provider notes

- Runtime registration uses `AddMySqlDb<TContext>()`.
- Provider: `MySql.EntityFrameworkCore 10.0.9`.
- EF Core packages are aligned to `10.0.9`.
- The SQL Server-only filtered index on `SanPham.Slug` was removed. MySQL unique indexes permit multiple NULL values.
