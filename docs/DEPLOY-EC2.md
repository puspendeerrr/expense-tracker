# Deploying SplitWise to AWS EC2

Written for someone who has not used AWS before. Every command starting with `$`
runs on your own laptop; every command starting with `ubuntu@server:~$` runs on
the server, after you have connected to it.

You will end up with one EC2 instance running three containers: the app, a
PostgreSQL database, and Caddy (which handles HTTPS for you automatically).

Budget about 45 minutes the first time.

---

## What you need before starting

- An AWS account (card required even on the free tier).
- A hostname. **HTTPS needs one** — a certificate cannot be issued for a bare IP
  address, and the session cookie is marked `Secure` in production, so over plain
  HTTP the browser silently discards it and nobody can log in. Either:
  - a domain you own, or
  - a free wildcard-DNS hostname such as `YOUR_IP.nip.io`, which needs no signup
    and works with Let's Encrypt. Good enough for a real deployment; see Step 3.
- Your project pushed to GitHub.

---

## Step 1 — Create the server

1. Sign in at <https://console.aws.amazon.com/>.
2. Top-right, pick a **region** near your users (for India, `ap-south-1`
   Mumbai). Everything you create belongs to the region selected at the time, so
   if resources seem to "disappear" later, check you are still in the same one.
3. Search for **EC2** and open it. Click **Launch instance**.

Fill the form in:

| Field | Value |
|---|---|
| Name | `splitwise` |
| AMI (operating system) | **Ubuntu Server 24.04 LTS** |
| Instance type | **t3.small** |
| Key pair | **Create new key pair** → name `splitwise-key`, type RSA, format `.pem` → **Download** |
| Storage | change 8 GiB to **20 GiB** |

> **On instance size:** `t2.micro` is the free-tier option, but it has 1 GB of
> RAM and the frontend build needs more than that — the build is killed partway
> through with no useful error. `t3.small` (2 GB) is roughly $15/month. If you
> must use `t2.micro`, see *Building elsewhere* at the end.

> **On the key pair:** the `.pem` file downloads **once** and cannot be retrieved
> again. Lose it and you lose access to the server. Save it somewhere permanent
> now.

Under **Network settings**, click **Edit** and allow:

| Type | Port | Source | Why |
|---|---|---|---|
| SSH | 22 | **My IP** | so you can log in |
| HTTP | 80 | Anywhere `0.0.0.0/0` | Let's Encrypt validates over port 80 |
| HTTPS | 443 | Anywhere `0.0.0.0/0` | the actual site |

Leave the database port closed. Postgres is only reachable from inside Docker.

Click **Launch instance**.

---

## Step 2 — Give it a fixed IP

A stopped instance gets a *new* address when it restarts, which would break your
domain. Pin one:

1. EC2 sidebar → **Elastic IPs** → **Allocate Elastic IP address** → **Allocate**.
2. Select it → **Actions** → **Associate** → choose your `splitwise` instance →
   **Associate**.

Write this address down. Everything below refers to it as `YOUR_IP`.

> **Use the public address, not the private one.** Every EC2 instance has two,
> and the Details panel lists them one above the other:
>
> | Field | Example | Use it? |
> |---|---|---|
> | Public IPv4 address / Elastic IP | `13.234.56.78` | **yes** |
> | Private IPv4 address | `172.31.6.140` | no |
>
> Anything beginning `172.31.`, `10.` or `192.168.` is a private address that
> exists only inside AWS's own network. Connecting to one from your laptop does
> not fail immediately — it hangs and then times out, because the packets are
> routed nowhere rather than actively refused.

> An Elastic IP is free while attached to a *running* instance, and billed if you
> leave it allocated to nothing. Release it if you tear the instance down.

---

## Step 3 — Point a hostname at it

### Option A — no domain, nothing to configure

`nip.io` and `sslip.io` are public DNS services that resolve any hostname of the
form `<ip>.nip.io` straight back to that IP. Nothing to register and nothing to
wait for:

```
DOMAIN=3.7.163.92.nip.io
```

Substitute your own Elastic IP. Caddy obtains a normal Let's Encrypt certificate
for it, so the site is properly trusted — not self-signed.

Two caveats worth knowing before you rely on it: the address is tied to the IP, so
releasing the Elastic IP changes your URL; and because everyone shares the `nip.io`
domain, it is occasionally rate-limited by Let's Encrypt. Fine for getting running
and for internal use — buy a domain before handing the link to real users.

Skip to Step 4.

### Option B — a domain you own

In whatever service manages your domain (GoDaddy, Namecheap, Cloudflare,
Route 53), add one record:

| Type | Name | Value |
|---|---|---|
| A | `@` (or a subdomain like `app`) | `YOUR_IP` |

If you use Cloudflare, set the record to **DNS only** (grey cloud) for the first
deploy. Its proxy interferes with certificate issuance.

Check it has taken effect before continuing:

```bash
$ nslookup yourdomain.com
```

It must return `YOUR_IP`. This can take anywhere from a minute to an hour. **Do
not continue until it does** — Caddy will fail to obtain a certificate, and
repeated failures hit Let's Encrypt's rate limit for that domain.

---

## Step 4 — Connect to the server

SSH refuses to use a private key that other accounts on the machine can read,
so the key file has to be locked down first. How you do that differs by
operating system.

### macOS or Linux

```bash
$ chmod 400 ~/Downloads/splitwise-key.pem
$ ssh -i ~/Downloads/splitwise-key.pem ubuntu@YOUR_IP
```

### Windows

`chmod` does nothing useful here — Windows uses ACLs rather than Unix
permission bits, and a file in `Downloads` inherits access for other accounts.
Ignoring this produces:

```
WARNING: UNPROTECTED PRIVATE KEY FILE!
Permissions for '.\splitwise-key.pem' are too open.
Load key ".\splitwise-key.pem": bad permissions
ubuntu@YOUR_IP: Permission denied (publickey).
```

Note the last line: SSH did not merely warn, it *ignored the key entirely* and
then failed to authenticate because it had no key left to offer.

In PowerShell, from the folder holding the file:

```powershell
# Stop inheriting permissions from the parent folder, drop every existing
# entry, then grant read access to yourself and nobody else.
> icacls .\splitwise-key.pem /inheritance:r
> icacls .\splitwise-key.pem /grant:r "$($env:USERNAME):(R)"

# Confirm: the only line listed should be your own account with (R).
> icacls .\splitwise-key.pem

> ssh -i .\splitwise-key.pem ubuntu@YOUR_IP
```

If `icacls` reports *"No mapping between account names and security IDs"*, pass
the fully qualified name instead:

```powershell
> icacls .\splitwise-key.pem /grant:r "$(whoami):(R)"
```

> **Move the key somewhere permanent.** `Downloads` gets cleared, and this file
> cannot be downloaded again — losing it means losing access to the server.
> `C:\Users\YOU\.ssh\` is the conventional home for it. Redo the `icacls`
> commands after moving it, since a moved file picks up its new folder's
> permissions.

Answer `yes` to the fingerprint prompt.

Your prompt then changes to something like `ubuntu@ip-172-31-6-140` — that is the
machine's internal *hostname*, which happens to contain its private address. It
is not something you connect to. Keep using `YOUR_IP` for SSH.

---

## Step 5 — Install Docker

```bash
ubuntu@server:~$ sudo apt update && sudo apt upgrade -y
ubuntu@server:~$ curl -fsSL https://get.docker.com | sudo sh
ubuntu@server:~$ sudo usermod -aG docker ubuntu
```

The last command lets you run Docker without `sudo`, but **only takes effect in a
new session**. Log out and back in:

```bash
ubuntu@server:~$ exit
$ ssh -i ~/Downloads/splitwise-key.pem ubuntu@YOUR_IP
ubuntu@server:~$ docker --version
```

---

## Step 6 — Get the code onto the server

```bash
ubuntu@server:~$ git clone https://github.com/YOUR_USERNAME/YOUR_REPO.git splitwise
ubuntu@server:~$ cd splitwise
```

For a private repository, generate a deploy key:

```bash
ubuntu@server:~$ ssh-keygen -t ed25519 -C "ec2" -f ~/.ssh/id_ed25519 -N ""
ubuntu@server:~$ cat ~/.ssh/id_ed25519.pub
```

Copy that output into GitHub → your repo → **Settings** → **Deploy keys** →
**Add deploy key** (read access is enough). Then clone with the SSH URL
(`git@github.com:...`) instead.

---

## Step 7 — Write the configuration

```bash
ubuntu@server:~$ cp .env.production.example .env
ubuntu@server:~$ nano .env
```

Generate each secret with this, run once per secret:

```bash
ubuntu@server:~$ openssl rand -base64 32
```

Fill in at minimum:

- `DOMAIN` — your domain, no `https://`, no trailing slash
- `POSTGRES_PASSWORD`
- `JWT_SECRET`
- `OTP_HASH_SECRET`
- `ADMIN_EMAIL` and `ADMIN_PASSWORD` (12+ characters)

Leave Resend, Cloudinary and VAPID blank for now if you like — the app runs
without them. Email codes appear in the logs instead of being delivered, and
image uploads are disabled rather than broken.

In nano: `Ctrl+O`, `Enter` to save, `Ctrl+X` to exit.

> **Get `POSTGRES_PASSWORD` right the first time.** It is applied only when the
> database volume is first created. Changing it later has no effect — the old
> password keeps working and the new one fails, which is confusing to debug. To
> genuinely change it you must delete the volume, destroying the data.

---

## Step 8 — Start everything

```bash
ubuntu@server:~$ docker compose -f docker-compose.prod.yml up -d --build
```

The first build takes 5–10 minutes. Watch it come up:

```bash
ubuntu@server:~$ docker compose -f docker-compose.prod.yml logs -f
```

You are looking for:

```
app-1    | [db] migrations applied
app-1    | {"level":"info","message":"static.serving",...}
app-1    | {"level":"info","message":"server.started","port":5000,...}
caddy-1  | certificate obtained successfully
```

`Ctrl+C` stops following the logs; it does not stop the containers.

Now open `https://yourdomain.com`. You should get the app over HTTPS with a valid
certificate.

---

## Step 9 — Create your admin account

```bash
ubuntu@server:~$ docker compose -f docker-compose.prod.yml exec app npm run db:seed:admin
```

Sign in with the `ADMIN_EMAIL` and `ADMIN_PASSWORD` from your `.env`, then change
the password from within the app.

---

## Importing data from the old MongoDB app

Skip this unless you are migrating an existing group across.

The migration reads the legacy MongoDB database and writes into Postgres. It is
**read-only on the source** — every collection is wrapped so that an accidental
write throws instead of altering the original data — and it is safe to run more
than once, because each migrated row carries its legacy id and a second run
reports rows as already present rather than duplicating them.

**1. Add the connection string to `.env`:**

```bash
ubuntu@server:~$ nano .env
```

```
SOURCE_MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/dbname
ALLOW_PRODUCTION_MIGRATION=1
```

`ALLOW_PRODUCTION_MIGRATION` exists so that writing to a live database is never
accidental. Set it only while migrating.

**2. Recreate the container so it picks the new values up:**

```bash
ubuntu@server:~$ docker compose -f docker-compose.prod.yml up -d
```

> This step is not optional. `docker compose exec` runs inside the *existing*
> container, whose environment was fixed when it was created — editing `.env`
> alone changes nothing, and the migration will fail saying the URI is missing.

**3. Dry run first.** Nothing is written; it reports exactly what it would do:

```bash
ubuntu@server:~$ docker compose -f docker-compose.prod.yml exec app npm run migrate:group -- --code YOUR_GROUP_CODE --dry-run
```

`--code` is the invite code of the group in the old app. Read the report: it
lists users, expenses, settlements and activity counts, and verifies that the
balances it computed match the source.

**4. Run it for real** once the dry run looks right:

```bash
ubuntu@server:~$ docker compose -f docker-compose.prod.yml exec app npm run migrate:group -- --code YOUR_GROUP_CODE
```

**5. Remove the permission flag afterwards:**

```bash
ubuntu@server:~$ nano .env      # delete ALLOW_PRODUCTION_MIGRATION
ubuntu@server:~$ docker compose -f docker-compose.prod.yml up -d
```

Useful flags:

| Flag | Meaning |
|---|---|
| `--code XXXXXX` | which group to import, by its old invite code |
| `--dry-run` | report only, write nothing |
| `--tz-offset 330` | minutes east of UTC for interpreting legacy dates (330 = IST, the default) |
| `--skip-verify` | skip the balance cross-check — not recommended |

---

## Deploying a change later

```bash
ubuntu@server:~$ cd splitwise
ubuntu@server:~$ git pull
ubuntu@server:~$ docker compose -f docker-compose.prod.yml up -d --build
```

Database migrations run automatically on start. There is about 30 seconds of
downtime while the container restarts.

---

## Backups

The database lives in a Docker volume. **A snapshot of the volume is not enough
on its own** — take real dumps:

```bash
ubuntu@server:~$ docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U splitwise splitwise | gzip > backups/$(date +%F).sql.gz
```

To run that nightly at 3am:

```bash
ubuntu@server:~$ crontab -e
```

Add:

```
0 3 * * * cd /home/ubuntu/splitwise && docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U splitwise splitwise | gzip > backups/$(date +\%F).sql.gz
```

Copy a backup to your laptop periodically — a backup that only exists on the
server is lost along with the server:

```bash
$ scp -i ~/Downloads/splitwise-key.pem ubuntu@YOUR_IP:~/splitwise/backups/*.gz ./
```

To restore:

```bash
ubuntu@server:~$ gunzip -c backups/2026-01-15.sql.gz | docker compose -f docker-compose.prod.yml exec -T postgres psql -U splitwise splitwise
```

---

## When something is wrong

**Check what is running:**

```bash
ubuntu@server:~$ docker compose -f docker-compose.prod.yml ps
ubuntu@server:~$ docker compose -f docker-compose.prod.yml logs app --tail 50
ubuntu@server:~$ docker compose -f docker-compose.prod.yml logs caddy --tail 50
```

| Symptom | Cause | Fix |
|---|---|---|
| `ssh: connect to host ... port 22: Connection timed out` | Using the private `172.31.x.x` address | use the Public IPv4 / Elastic IP instead (Step 2) |
| SSH times out on the *correct* address | Your home IP changed, so the "My IP" rule no longer matches | EC2 → Security Groups → edit the SSH rule → **My IP** again |
| `bad permissions` then `Permission denied (publickey)` | Windows key file readable by other accounts | run the `icacls` commands in Step 4 |
| `Permission denied (publickey)` | Wrong username | it is `ubuntu` for Ubuntu images, not `ec2-user` or `root` |
| `exec: " npm": executable file not found` | A `\` line-continuation was pasted onto one line, turning it into an escaped space | drop the `\` and run the command on a single line |
| Browser cannot connect at all | Security group missing 80/443 | EC2 → Security Groups → add the rules |
| Certificate error | DNS not pointing at the server yet | `nslookup yourdomain.com`; wait, then `docker compose -f docker-compose.prod.yml restart caddy` |
| `CLIENT_ORIGINS is not set for production` | `DOMAIN` missing from `.env` | set it, then `up -d` again |
| `password authentication failed` | `POSTGRES_PASSWORD` changed after the volume existed | see the warning in Step 7 |
| Build killed around "building client" | Out of RAM on a small instance | use `t3.small`, or *Building elsewhere* below |
| `Upload preset not found` on image upload | The Cloudinary preset does not exist or is not **unsigned** | create it in Cloudinary → Settings → Upload → Upload presets |
| Everything looks fine, site is blank | Stale cached shell | hard-refresh (`Ctrl+Shift+R`) |
| Page loads over `http://`, login appears to succeed then bounces back | The session cookie is `Secure`, so it is dropped on plain HTTP | use HTTPS — see Step 3 |

**Free some disk space** (old images accumulate with each deploy):

```bash
ubuntu@server:~$ docker system prune -af
```

---

## Building elsewhere (for 1 GB instances)

If you are set on `t2.micro`, build the image on your laptop and ship it rather
than building on the server:

```bash
$ docker build -t splitwise:latest .
$ docker save splitwise:latest | gzip | ssh -i ~/Downloads/splitwise-key.pem ubuntu@YOUR_IP "gunzip | docker load"
```

Then on the server, edit `docker-compose.prod.yml` to replace the `build:` block
with `image: splitwise:latest`, and run `up -d` without `--build`.

---

## Shutting it down

To stop paying:

1. EC2 → Instances → select → **Instance state** → **Terminate**.
2. EC2 → **Elastic IPs** → select → **Actions** → **Release**.
3. EC2 → **Volumes** → delete any left behind.

Terminating destroys the database. Take a backup first.
