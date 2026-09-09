# Repository notes

- Default branch: `develop`.
- NPMplus is a single main container supervised by dinit. It serves the React/Vite UI and Node API through its custom nginx build and uses SQLite by default.
- The main Compose service intentionally uses `network_mode: host`; do not add `ports` or `networks` to it. Default listeners are 80/tcp, 443/tcp+udp, and 81/tcp.
- Optional Compose profiles are `crowdsec`, `anubis`, `geoip`, and `caddy`. Their bridge ports are loopback-only except Caddy's public port 80.
- Profile prerequisites: CrowdSec needs `LOGROTATE=true`; Anubis needs `AUTH_REQUEST_ANUBIS_UPSTREAM=http://127.0.0.1:8923`; GeoIP needs both files in `secrets/`; Caddy needs `DISABLE_HTTP=true`.
- `deployment/anubis/botPolicies.yaml` is the Anubis v1.27.0 default policy with only auth-request status codes changed to 401/403.
- Validate deployment changes with `docker compose config -q` and `docker compose --profile '*' config -q`.
- Backend checks: `cd backend && pnpm install --frozen-lockfile && pnpm run check && pnpm run validate-schema`.
- Frontend checks: `cd frontend && pnpm install --frozen-lockfile && pnpm run lint && pnpm run typecheck && pnpm run build`.
- The local environment may have Docker CLI without `/var/run/docker.sock`; static Compose validation still works, but runtime tests require a daemon.
