<div align="center">

# <img src="docs/images/logo.png" width="48" height="48" align="center" style="margin-right: 10px;" /> Noteer

**A modern, self-hosted notes application**

[![Docker Pulls](https://img.shields.io/docker/pulls/ghcr.io/bigtcze/noteer?style=flat-square&logo=docker&logoColor=white&label=Docker%20Pulls)](https://github.com/bigtcze/noteer/pkgs/container/noteer)
[![GitHub Release](https://img.shields.io/github/v/release/bigtcze/noteer?style=flat-square&logo=github&label=Release)](https://github.com/bigtcze/noteer/releases)
[![License](https://img.shields.io/github/license/bigtcze/noteer?style=flat-square)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/bigtcze/noteer/ci.yml?style=flat-square&logo=github-actions&logoColor=white&label=CI)](https://github.com/bigtcze/noteer/actions/workflows/ci.yml)

<img src="docs/images/screenshot.png" alt="Noteer Screenshot" width="800" />

</div>

---

## ✨ Features

- 📋 **Notes & Checklists** - Create notes with rich text and interactive checklists
- 🏷️ **Labels** - Organize notes with customizable labels
- 📌 **Pin & Archive** - Pin important notes, archive completed ones
- 🕒 **Version History** - Store file versions and restore/rollback to previous states
- 🎨 **Color Coding** - 11 beautiful colors to categorize your notes
- 🔒 **Secure Authentication** - Local login or OIDC (Authentik, Authelia, PocketID, etc.)
- 🔐 **End-to-End Encryption** - Your notes are encrypted with a 24-word recovery phrase. Zero-knowledge - not even the server admin can read your data.
- 👥 **Multi-user & Admin Panel** - User management with admin/user roles
- 📱 **Responsive Design** - Works beautifully on desktop and mobile

---

## 🚀 Quick Start

### Docker Run

```bash
docker run -d \
  --name noteer \
  -p 3000:3000 \
  -v noteer-db:/var/lib/postgresql/data \
  -v noteer-data:/var/lib/noteer \
  -e ADMIN_EMAIL=admin@example.com \
  -e ADMIN_PASSWORD=your-secure-password \
  ghcr.io/bigtcze/noteer:latest
```

Open [http://localhost:3000](http://localhost:3000) and login with your admin credentials.

### Docker Compose

```yaml
services:
  noteer:
    image: ghcr.io/bigtcze/noteer:latest
    container_name: noteer
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - noteer-db:/var/lib/postgresql/data
      - noteer-data:/var/lib/noteer
    environment:
      - ADMIN_EMAIL=admin@example.com
      - ADMIN_PASSWORD=your-secure-password

volumes:
  noteer-db:
  noteer-data:
```

---

## ⚙️ Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Application port |
| `ADMIN_EMAIL` | `admin@example.com` | Admin user email |
| `ADMIN_PASSWORD` | `changeme` | Admin user password |
| `NOTE_VERSION_LIMIT` | `10` | Max stored versions per note (FIFO) |
| `REGISTRATION_ENABLED` | `true` | Allow new user registration |
| `TRUST_PROXY` | `1` | Proxy trust config: number (hops) or string (`loopback`, CIDR) |
| `SSL_ENABLED` | `false` | Enable direct HTTPS |
| `SSL_CERT_PATH` | - | Path to SSL certificate |
| `SSL_KEY_PATH` | - | Path to SSL key |

### SSO / OIDC Configuration

Noteer supports OpenID Connect (OIDC) for single sign-on with providers like Authentik, Authelia, Keycloak, and more.

**Configuration via Admin Panel:**
1. Login as admin
2. Navigate to **Admin Panel**
3. Find the **SSO / OIDC Settings** section
4. Enter your OIDC provider details:
   - Issuer URL (e.g., `https://auth.example.com`)
   - Client ID
   - Client Secret
5. Click **Test Connection** to verify
6. Click **Save Settings**

**Callback URL for your Identity Provider:**
`[YOUR_APP_URL]/api/auth/callback`

Examples:
- Local: `http://localhost:3000/api/auth/callback`
- Production: `https://notes.example.com/api/auth/callback`



### Reverse Proxy (Recommended)

<details>
<summary>Traefik</summary>

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.noteer.rule=Host(`notes.example.com`)"
  - "traefik.http.routers.noteer.entrypoints=websecure"
  - "traefik.http.routers.noteer.tls.certresolver=letsencrypt"
  - "traefik.http.services.noteer.loadbalancer.server.port=3000"
```
</details>

<details>
<summary>Nginx Proxy Manager</summary>

1. Add new proxy host
2. Domain: `notes.example.com`
3. Forward Hostname: `noteer` (container name)
4. Forward Port: `3000`
5. Enable SSL with Let's Encrypt
</details>

<details>
<summary>Caddy</summary>

```caddyfile
notes.example.com {
    reverse_proxy noteer:3000
}
```
</details>

### Direct HTTPS (without reverse proxy)

Mount your certificates and enable SSL:

```bash
docker run -d \
  --name noteer \
  -p 443:3000 \
  -v noteer-db:/var/lib/postgresql/data \
  -v noteer-data:/var/lib/noteer \
  -v /path/to/cert.pem:/certs/cert.pem:ro \
  -v /path/to/key.pem:/certs/key.pem:ro \
  -e SSL_ENABLED=true \
  -e SSL_CERT_PATH=/certs/cert.pem \
  -e SSL_KEY_PATH=/certs/key.pem \
  ghcr.io/bigtcze/noteer:latest
```

---

## 🗺️ Roadmap

### 📱 Mobile Apps (Planned)
- [ ] 🤖 Android app (native)
- [ ] 📲 PWA support

### 🔧 Features (Planned)
- [ ] 🔔 Reminders & notifications
- [ ] 🔍 Advanced search with filters
- [ ] 📤 Export (Markdown, PDF)
- [ ] 🔄 Offline sync
- [ ] 🔽 Sorting notes (alphabetical, by date)

---

## 🛠️ Development

### Prerequisites

- Node.js 20+
- PostgreSQL 16+ (or use Docker)

### Building from Source (Docker)

To build the image locally:

```bash
git clone https://github.com/bigtcze/noteer.git
cd noteer
docker build -t noteer:local -f docker/Dockerfile .
```

### Local Development

**Prerequisites:**
- Node.js 20+
- PostgreSQL 16+ (running locally or in Docker)
- Git

**Backend Setup:**
```bash
cd backend
npm install
cp ../docker/.env.example .env
npm run dev
```

**Frontend Setup:**
```bash
cd frontend
npm install
npm run dev
```

### Testing

```bash
# Run Playwright E2E tests
npx playwright test
```

---

## 📄 License

Apache License 2.0 - see [LICENSE](LICENSE) for details.

---

<div align="center">

Made with ❤️ for the self-hosted community

[Report Bug](https://github.com/bigtcze/noteer/issues) · [Request Feature](https://github.com/bigtcze/noteer/issues)

</div>
