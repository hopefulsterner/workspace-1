# 🚀 AI Digital Friend Zone - Production Deployment Guide

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                           USERS                                       │
│                    (Browser / Mobile App)                             │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        CLOUDFLARE                                     │
│              (CDN, DDoS Protection, SSL)                              │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      LOAD BALANCER                                    │
│                   (Nginx / AWS ALB)                                   │
└────────────────────────────┬─────────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│   Frontend    │   │   API Server  │   │   WebSocket   │
│   (React)     │   │   (Express)   │   │   (Socket.io) │
│   Port 3000   │   │   Port 4000   │   │   Port 4000   │
└───────────────┘   └───────┬───────┘   └───────┬───────┘
                            │                   │
        ┌───────────────────┼───────────────────┤
        ▼                   ▼                   ▼
┌───────────────┐   ┌───────────────┐   ┌───────────────┐
│  PostgreSQL   │   │    Redis      │   │   S3/R2       │
│  (Database)   │   │   (Cache)     │   │  (Storage)    │
└───────────────┘   └───────────────┘   └───────────────┘
```

---

## 🛠️ Quick Start (Development)

### Prerequisites
- Node.js 20+
- Docker & Docker Compose
- PostgreSQL (or use Docker)

### 1. Clone & Setup
```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd server
npm install

# Copy environment file
cp .env.example .env
# Edit .env with your API keys
```

### 2. Start Database
```bash
docker-compose up postgres redis -d
```

### 3. Run Migrations
```bash
cd server
npx prisma migrate dev
```

### 4. Start Development
```bash
# Terminal 1 - Backend
cd server
npm run dev

# Terminal 2 - Frontend
npm run dev
```

---

## 🏭 Production Deployment Options

### Option 1: Docker Compose (VPS/Dedicated Server)

**Best for:** Full control, cost-effective for medium traffic

```bash
# 1. Set environment variables
cp .env.example .env.production
# Edit with production values

# 2. Build and start
docker-compose -f docker-compose.yml up -d --build

# 3. Run migrations
docker-compose exec api npx prisma migrate deploy
```

**Recommended VPS Providers:**
- DigitalOcean Droplet ($24/mo - 4GB RAM)
- Hetzner Cloud (€15/mo - 8GB RAM)
- Linode ($24/mo - 4GB RAM)

---

### Option 2: Vercel + Railway (Serverless)

**Best for:** Auto-scaling, zero DevOps

**Frontend (Vercel):**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel --prod
```

**Backend (Railway):**
1. Connect GitHub repo to Railway
2. Add PostgreSQL & Redis plugins
3. Set environment variables
4. Deploy automatically on push

---

### Option 3: AWS (Enterprise Scale)

**Services Used:**
- ECS Fargate (Containers)
- RDS PostgreSQL (Database)
- ElastiCache Redis (Cache)
- S3 (File Storage)
- CloudFront (CDN)
- ALB (Load Balancer)

**Terraform Infrastructure:**
```hcl
# See /infrastructure/aws/main.tf for complete setup
```

---

## 🔐 Security Best Practices

### 1. Environment Variables
```env
# NEVER commit these to git
JWT_SECRET=use-256-bit-random-string
DATABASE_URL=use-ssl-connection
```

### 2. Rate Limiting
Already configured in `server/src/index.ts`:
- 100 requests per 15 minutes per IP
- Stricter limits for AI endpoints

### 3. CORS Configuration
```typescript
cors({
  origin: ['https://yourdomain.com'],
  credentials: true,
})
```

### 4. Database Security
- Use connection pooling (PgBouncer)
- Enable SSL for database connections
- Regular backups (daily)
- Encrypt sensitive data at rest

---

## 📊 Monitoring & Logging

### Recommended Stack
- **Logs:** Winston → Loki → Grafana
- **Metrics:** Prometheus → Grafana
- **Errors:** Sentry
- **Uptime:** UptimeRobot / Pingdom

### Health Check Endpoint
```
GET /health
Response: { "status": "ok", "timestamp": "..." }
```

---

## 💰 Cost Estimation (Monthly)

### Small Scale (< 1000 users)
| Service | Cost |
|---------|------|
| VPS (4GB) | $24 |
| Domain | $1 |
| SSL (Let's Encrypt) | Free |
| **Total** | **~$25/mo** |

### Medium Scale (1000-10000 users)
| Service | Cost |
|---------|------|
| VPS (8GB) x2 | $80 |
| Managed PostgreSQL | $25 |
| Redis | $15 |
| S3 Storage | $10 |
| Cloudflare Pro | $20 |
| **Total** | **~$150/mo** |

### Large Scale (10000+ users)
| Service | Cost |
|---------|------|
| AWS ECS Fargate | $200+ |
| RDS PostgreSQL | $100+ |
| ElastiCache | $50+ |
| S3 + CloudFront | $50+ |
| **Total** | **$400+/mo** |

---

## 🔄 CI/CD Pipeline

### GitHub Actions Example
```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Build & Push Docker
        run: |
          docker build -t myapp:latest .
          docker push registry/myapp:latest
      
      - name: Deploy to Server
        run: |
          ssh user@server 'cd /app && docker-compose pull && docker-compose up -d'
```

---

## 🚨 Troubleshooting

### Database Connection Issues
```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# View logs
docker-compose logs postgres
```

### WebSocket Not Working
- Ensure nginx/proxy supports WebSocket upgrade
- Check CORS settings
- Verify firewall allows port 4000

### High Memory Usage
- Increase Node.js memory: `NODE_OPTIONS=--max-old-space-size=4096`
- Check for memory leaks with `node --inspect`

---

## 📞 Support

For production support and enterprise features:
- Email: support@aifriendzone.com
- Documentation: https://docs.aifriendzone.com
