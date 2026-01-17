# ============================================
# EC2 Quick Deploy Guide
# ============================================

## Prerequisites
- AWS Account
- EC2 Instance (Ubuntu 22.04 LTS recommended)
- At least t2.medium (2 vCPU, 4GB RAM)
- 20GB+ storage
- Security Group with ports: 22, 80, 443, 3000, 4000

## Step 1: Launch EC2 Instance

1. Go to AWS Console → EC2 → Launch Instance
2. Choose: Ubuntu Server 22.04 LTS
3. Instance type: t2.medium (or larger)
4. Configure Security Group:
   ```
   SSH (22)     - Your IP
   HTTP (80)    - Anywhere
   HTTPS (443)  - Anywhere
   Custom (3000) - Anywhere (Frontend)
   Custom (4000) - Anywhere (API)
   ```
5. Create/select key pair for SSH access
6. Launch!

## Step 2: Connect to EC2

```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
```

## Step 3: Run Setup Script

```bash
# Download and run setup script
curl -O https://raw.githubusercontent.com/your-repo/setup-ec2.sh
chmod +x setup-ec2.sh
sudo ./setup-ec2.sh

# Or manually:
sudo apt update && sudo apt upgrade -y
sudo apt install -y docker.io docker-compose git
sudo systemctl start docker
sudo systemctl enable docker
sudo usermod -aG docker ubuntu
```

## Step 4: Deploy Application

```bash
# Go to app directory
cd /opt/ai-friend-zone

# Clone repository (or upload files)
git clone https://github.com/your-username/ai-friend-zone.git .

# Or use SCP to upload:
# scp -i your-key.pem -r ./project/* ubuntu@your-ec2-ip:/opt/ai-friend-zone/
```

## Step 5: Configure Environment

```bash
# Edit root .env
nano .env
# Change: VITE_API_URL=http://YOUR_EC2_IP:4000
#         VITE_WS_URL=ws://YOUR_EC2_IP:4000

# Edit server .env
nano server/.env
# Fill in:
# - CORS_ORIGIN=http://YOUR_EC2_IP:3000
# - JWT_SECRET (generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
# - GOOGLE_AI_KEY (get free at https://makersuite.google.com/app/apikey)
# - Database password (change default)
```

## Step 6: Start Application

```bash
# Start all containers
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f

# Stop
docker compose down
```

## Step 7: Access Your App

Open browser: `http://YOUR_EC2_PUBLIC_IP:3000`

## Useful Commands

```bash
# Restart everything
docker compose restart

# Rebuild and restart
docker compose up -d --build

# View specific service logs
docker compose logs -f api
docker compose logs -f frontend

# Access database
docker compose exec postgres psql -U postgres -d ai_friend_zone

# Access Redis
docker compose exec redis redis-cli

# Run database migrations
docker compose exec api npx prisma migrate deploy
```

## Troubleshooting

### Container won't start
```bash
docker compose logs api  # Check for errors
docker compose down
docker compose up -d
```

### Database connection error
```bash
# Make sure postgres is running
docker compose ps

# Check DATABASE_URL in server/.env matches docker-compose.yml
# Host should be 'postgres' (container name), not 'localhost'
```

### CORS errors in browser
- Make sure CORS_ORIGIN in server/.env matches your frontend URL
- Include http:// protocol

### Port already in use
```bash
sudo lsof -i :3000  # Find process
sudo kill -9 PID    # Kill it
```

## Security Checklist

- [ ] Change default database password
- [ ] Generate strong JWT_SECRET
- [ ] Set up SSL with Let's Encrypt
- [ ] Restrict SSH to your IP only
- [ ] Enable AWS CloudWatch monitoring
- [ ] Set up automated backups
- [ ] Use AWS Secrets Manager for production keys

## Optional: Set Up Domain & SSL

```bash
# Install Certbot
sudo apt install -y certbot

# Get SSL certificate
sudo certbot certonly --standalone -d yourdomain.com

# Update nginx config to use SSL
```

## Cost Estimate (AWS EC2)

| Instance | vCPU | RAM | Monthly Cost |
|----------|------|-----|--------------|
| t2.micro | 1 | 1GB | ~$8 (free tier eligible) |
| t2.small | 1 | 2GB | ~$17 |
| t2.medium | 2 | 4GB | ~$34 |
| t2.large | 2 | 8GB | ~$68 |

Recommended: Start with t2.medium for testing
