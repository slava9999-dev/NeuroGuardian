#!/bin/bash

# ==========================================
# NeuroGUARDIAN — Production Setup Script
# For Ubuntu 22.04 (High Profy Server)
# ==========================================

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🚀 Initializing NeuroGUARDIAN Deployment...${NC}"

# 1. Update System
echo -e "\n${GREEN}[1/5] Updating System Packages...${NC}"
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y curl git ufw Fail2Ban

# 2. Install Docker & Compose (if missing)
if ! command -v docker &> /dev/null; then
    echo -e "\n${GREEN}[2/5] Installing Docker...${NC}"
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    sudo usermod -aG docker $USER
else
    echo -e "\n${GREEN}[2/5] Docker already installed.${NC}"
fi

# 3. Security Hardening (UFW)
echo -e "\n${GREEN}[3/5] Configuring Firewall...${NC}"
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw allow 3000/tcp # API (Optional, better via Nginx)
# Block direct database access from outside
sudo ufw deny 5432/tcp 
sudo ufw deny 6379/tcp
sudo ufw deny 3002/tcp # Browserless internal
echo "y" | sudo ufw enable

# 4. Environment Setup
echo -e "\n${GREEN}[4/5] Setting up Environment...${NC}"
mkdir -p /opt/neuroguardian
# Clone rep or copy files (Logic to be added via CI/CD)

# 5. Launch
echo -e "\n${GREEN}[5/5] Ready to Launch!${NC}"
echo -e "Run: docker compose -f docker-compose.prod.yml up -d"
