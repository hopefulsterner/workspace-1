#!/bin/bash
# ============================================
# AI Digital Friend Zone - EC2 Setup Script
# ============================================
# Run this on a fresh Ubuntu EC2 instance
# chmod +x setup-ec2.sh && sudo ./setup-ec2.sh

set -e

echo "🚀 AI Digital Friend Zone - EC2 Setup"
echo "======================================"

# Update system
echo "📦 Updating system packages..."
apt-get update && apt-get upgrade -y

# Install Docker
echo "🐳 Installing Docker..."
apt-get install -y apt-transport-https ca-certificates curl software-properties-common
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Start Docker
systemctl start docker
systemctl enable docker

# Add ubuntu user to docker group
usermod -aG docker ubuntu

# Install Node.js (for local development/testing)
echo "📗 Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install Git
echo "📚 Installing Git..."
apt-get install -y git

# Create app directory
echo "📁 Creating app directory..."
mkdir -p /opt/ai-friend-zone
chown ubuntu:ubuntu /opt/ai-friend-zone

# Firewall setup
echo "🔥 Configuring firewall..."
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw allow 3000/tcp  # Frontend
ufw allow 4000/tcp  # API
ufw --force enable

echo ""
echo "✅ EC2 Setup Complete!"
echo "======================================"
echo ""
echo "Next steps:"
echo "1. Clone your repo to /opt/ai-friend-zone"
echo "   cd /opt/ai-friend-zone"
echo "   git clone your-repo-url ."
echo ""
echo "2. Copy and edit environment files:"
echo "   cp .env.example .env"
echo "   cp server/.env.example server/.env"
echo "   nano server/.env  # Fill in your keys"
echo ""
echo "3. Generate secure secrets:"
echo "   node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\""
echo ""
echo "4. Start the application:"
echo "   docker compose up -d"
echo ""
echo "5. Access your app at:"
echo "   http://YOUR_EC2_PUBLIC_IP:3000"
echo ""
echo "======================================"
