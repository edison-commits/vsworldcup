# VS WORLDCUP Deployment & Recovery

## Repo paths
- App repo: `/opt/vsworldcup/vs-worldcup`
- Bare git remote: `/opt/vsworldcup/git/vs-worldcup.git`
- Service: `vsworldcup.service`
- Public URL: `https://vsworldcup.com`
- API URL: `https://api.vsworldcup.com/api/generate`

## Current git-backed flow
Inside the app repo:
- branch: `master`
- remote: `origin -> /opt/vsworldcup/git/vs-worldcup.git`

## Standard deploy
```bash
cd /opt/vsworldcup/vs-worldcup
./scripts/deploy-and-smoke.sh
```

What it does:
1. `npm run build`
2. restarts `vsworldcup.service`
3. checks local app on `127.0.0.1:3000`
4. checks public site on `https://vsworldcup.com`
5. checks the generate API with a real POST request

## Git workflow
```bash
cd /opt/vsworldcup/vs-worldcup
git status
git add -A
git commit -m "your message"
git push
```

## Smoke test only
From the assistant workspace:
```bash
/Users/edison/.openclaw/workspace/memory/agents/smoke-test-vsworldcup.sh /opt/vsworldcup/vs-worldcup vsworldcup
```

## Fast health checks
```bash
systemctl is-active vsworldcup.service
curl -I http://127.0.0.1:3000
curl -I https://vsworldcup.com
curl -X POST https://api.vsworldcup.com/api/generate \
  -H 'Content-Type: application/json' \
  --data '{"prompt":"best pizza toppings","count":4}'
```

## Recovery notes
- If the app serves bad content or wrong content, verify port 3000 is owned by the expected service.
- If the frontend is broken, rebuild from `/opt/vsworldcup/vs-worldcup` and restart `vsworldcup.service`.
- If health checks fail after changes, use `git log`, `git diff`, and repo backups before rolling back.
