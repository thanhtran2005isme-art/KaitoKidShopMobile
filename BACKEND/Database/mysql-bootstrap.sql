-- KaitoKid MySQL bootstrap
-- Change CHANGE_ME before running outside a disposable local environment.

CREATE DATABASE IF NOT EXISTS KaitoKid
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

CREATE USER IF NOT EXISTS 'kaitokid'@'localhost'
  IDENTIFIED BY 'CHANGE_ME';

ALTER USER 'kaitokid'@'localhost'
  IDENTIFIED BY 'CHANGE_ME';

GRANT ALL PRIVILEGES ON KaitoKid.* TO 'kaitokid'@'localhost';
FLUSH PRIVILEGES;
