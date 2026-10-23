#!/bin/bash
# Starts the test Postgres `lifecycle-pg` (postgres:17.5) published on 127.0.0.1:55432 only, capped at
# --memory=1g --memory-swap=1g --cpus=1, with a NEW random password that is never printed: it is written only to
# /srv/lifecycle/secrets/pgpass (PGPASSFILE format, read by kw.sh) and to a docker env-file, both mode 600.
set -euo pipefail
L=/srv/lifecycle
umask 077
mkdir -p $L/secrets
if docker ps -a --format '{{.Names}}' | grep -qx lifecycle-pg; then echo "lifecycle-pg already exists, refusing"; exit 1; fi
docker image inspect postgres:17.5 --format 'image postgres:17.5 id={{.Id}} size={{.Size}}' || { echo "postgres:17.5 image missing, refusing to pull"; exit 1; }
python3 -I -c 'import secrets, sys
pw = secrets.token_hex(24)
open(sys.argv[1], "w").write("POSTGRES_PASSWORD=%s\n" % pw)
open(sys.argv[2], "w").write("127.0.0.1:55432:*:postgres:%s\n" % pw)' $L/secrets/pg_l0.env $L/secrets/pgpass
chmod 600 $L/secrets/pg_l0.env $L/secrets/pgpass
docker run -d --name lifecycle-pg -p 127.0.0.1:55432:5432 --memory=1g --memory-swap=1g --cpus=1 \
  --env-file $L/secrets/pg_l0.env postgres:17.5 > /dev/null
for i in $(seq 1 60); do
  if docker exec lifecycle-pg pg_isready -U postgres -h 127.0.0.1 > /dev/null 2>&1; then break; fi
  sleep 1
done
sleep 2
docker exec lifecycle-pg pg_isready -U postgres -h 127.0.0.1
docker ps --filter name=lifecycle-pg --format 'container {{.Names}} {{.Image}} {{.Status}} ports={{.Ports}}'
ss -ltnH | grep ':55432' | awk '{print "listening " $4}'
ls -l $L/secrets | awk 'NR>1 {print "secrets file mode=" $1 " size=" $5}'
