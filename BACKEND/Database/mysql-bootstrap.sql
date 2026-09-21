-- KaitoKid MariaDB/XAMPP bootstrap
-- Target local: MariaDB 10.4.x bundled with XAMPP.
-- Replace CHANGE_ME before running.

CREATE DATABASE IF NOT EXISTS KaitoKid
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'kaitokid'@'localhost'
  IDENTIFIED BY 'CHANGE_ME';

ALTER USER 'kaitokid'@'localhost'
  IDENTIFIED BY 'CHANGE_ME';

GRANT ALL PRIVILEGES ON KaitoKid.* TO 'kaitokid'@'localhost';
FLUSH PRIVILEGES;
