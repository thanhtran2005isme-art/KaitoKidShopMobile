export interface MariaDbConnectionOptions {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  connectionLimit: number;
}

export function parseMariaDbUrl(rawUrl: string | undefined): MariaDbConnectionOptions {
  if (!rawUrl) {
    throw new Error(
      "DATABASE_URL chưa được cấu hình. Sao chép apps/api/.env.example thành apps/api/.env và điền tài khoản MariaDB hiện tại.",
    );
  }

  const url = new URL(rawUrl);
  if (url.protocol !== "mysql:" && url.protocol !== "mariadb:") {
    throw new Error("DATABASE_URL phải dùng giao thức mysql:// hoặc mariadb://.");
  }

  const database = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  if (!database) throw new Error("DATABASE_URL thiếu tên database.");

  return {
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    connectionLimit: Number(process.env.DATABASE_CONNECTION_LIMIT ?? 5),
  };
}
