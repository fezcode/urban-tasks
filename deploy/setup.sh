#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────
# Urban Tasks — Hetzner VPS setup script
# Run this once on a fresh Ubuntu 24.04 server
# Usage: ssh root@your-server 'bash -s' < deploy/setup.sh
# ──────────────────────────────────────────────

echo "==> Updating system"
apt-get update -qq && apt-get upgrade -y -qq

echo "==> Installing Docker"
curl -fsSL https://get.docker.com | sh
systemctl enable docker

echo "==> Creating deploy user"
useradd -m -s /bin/bash -G docker deploy
mkdir -p /home/deploy/.ssh
cp /root/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys

echo "==> Setting up firewall"
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 443/udp
ufw --force enable

echo "==> Creating app directory"
mkdir -p /opt/urban-tasks
chown deploy:deploy /opt/urban-tasks

echo "==> Setting up automatic security updates"
apt-get install -y -qq unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades

echo ""
echo "================================================================"
echo "  Setup complete!"
echo ""
echo "  Next steps:"
echo "  1. SSH in as deploy user: ssh deploy@$(hostname -I | awk '{print $1}')"
echo "  2. Clone repo: cd /opt/urban-tasks && git clone <your-repo> ."
echo "  3. Create .env: cp .env.example .env && nano .env"
echo "  4. Set DOMAIN, POSTGRES_PASSWORD, JWT_SECRET in .env"
echo "  5. Deploy: docker compose -f docker-compose.prod.yml up -d"
echo "================================================================"
