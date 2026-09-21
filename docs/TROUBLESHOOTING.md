# Troubleshooting

## Expo window closes immediately

### Symptom

The Expo terminal opens and disappears before the error can be read.

### Current behavior

The launch scripts keep Expo errors visible. If this regresses, ensure the Expo process is launched in a persistent terminal and that error paths pause before exiting.

## Windows reports `The syntax of the command is incorrect.`

### Cause seen previously

Nested `cmd /k` + `call` quoting around the Expo batch file caused invalid Windows CMD syntax.

### Fix

Root `run.bat` launches `scripts/run-mobile.bat` directly with `start` instead of nesting additional CMD quoting.

## `'expo' is not recognized as an internal or external command`

### Cause seen previously

`node_modules` existed, but the local Expo executable did not. Checking only for the directory produced a false positive.

### Current fix

`scripts/run-mobile.bat` checks:

```text
apps/mobile/node_modules/.bin/expo.cmd
```

If it is missing, the script runs `npm install`, then invokes the local Expo CLI directly.

## Mobile says “Chưa kết nối được backend”

Do not assume this always means the network path is wrong.

Check in this order:

1. Confirm Expo log shows the intended API.Customer URL.
2. Confirm API.Customer is listening on port 5265.
3. Inspect API.Customer console for EF Core/Pomelo exceptions.
4. Confirm MariaDB is running.
5. Confirm the database and user credentials work.
6. On a physical device, confirm LAN/firewall reachability.

A backend database exception can cause the mobile UI to show a generic backend connection message even when HTTP routing is otherwise correct.

## MariaDB error 1045 — Access denied

### Typical symptom

```text
ERROR 1045 (28000): Access denied for user 'kaitokid'@'localhost'
```

### Checks

Confirm MariaDB:

```bat
"C:\xampp\mysql\bin\mysql.exe" -u root -e "SELECT VERSION(); SHOW DATABASES;"
```

Confirm table count:

```bat
"C:\xampp\mysql\bin\mysql.exe" -u root -e "SELECT COUNT(*) AS table_count FROM information_schema.tables WHERE table_schema='kaitokid' AND table_type='BASE TABLE';"
```

Expected base table count for the current local schema: `51`.

Confirm the application DB user exists:

```bat
"C:\xampp\mysql\bin\mysql.exe" -u root -e "SELECT User,Host FROM mysql.user WHERE User='kaitokid';"
```

Then ensure the password in local MariaDB matches the password in the gitignored `backend/db.local.bat`.

Do not put the real password in committed `appsettings.json`.

## First run after cloning asks for DB configuration

This is expected.

`scripts/load-db-local.bat` creates:

```text
backend/db.local.bat
```

from:

```text
backend/db.local.example.bat
```

Replace `CHANGE_ME` with the local MariaDB password, save, and run the launcher again.

## Expo Web vs separate web app

- `127.0.0.1:8081` → Expo Web rendering of `apps/mobile`
- Vite development server (normally `localhost:5173`) → `apps/web`

A wide browser window at port 8081 is still the mobile code rendered for web; it is not the separate web client.

## Physical Android device cannot reach APIs

For Wi-Fi/LAN development:

- PC and phone should be on the same reachable network.
- API.Customer must listen on `0.0.0.0:5265`.
- Windows Firewall must allow the required port.
- Use `EXPO_PUBLIC_API_URL=http://<PC-LAN-IP>:5265` when auto-detection is unsuitable.

For USB/ADB development, the mobile launcher attempts reverse mappings for:

- 8081
- 5053
- 5265
