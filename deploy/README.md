# NeuroGUARDIAN Production Deployment Guide

## 1. Server Prerequisites

- **OS**: Ubuntu 22.04 LTS
- **CPU**: 4 Cores (Minimum)
- **RAM**: 8 GB (Minimum for Chrome Cluster)
- **Disk**: 60 GB NVMe

## 2. Quick Start

1. **Connect to Server**:

   ```bash
   ssh root@<YOUR_SERVER_IP>
   ```

2. **Copy Deployment Files**:
   Local command (PowerShell):

   ```powershell
   scp -r .\deploy\* root@<YOUR_SERVER_IP>:/root/
   ```

3. **Run Setup**:

   ```bash
   chmod +x setup.sh
   ./setup.sh
   ```

4. **Launch System**:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

## 3. Architecture Overview

| Service   | Port | Description | Resource Limit |
| --------- | ---- | ----------- | -------------- |
| **API**   | 3000 | Core Logic  | 1.5 CPU / 2GB  |
| **Eyes**  | 3002 | Browserless | 2.0 CPU / 3GB  |
| **DB**    | 5432 | PostgreSQL  | 1.0 CPU / 1GB  |
| **Redis** | 6379 | Caching     | Uncapped       |

## 4. Maintenance

- **Logs**: `docker compose -f docker-compose.prod.yml logs -f api`
- **Update**: `git pull && docker compose -f docker-compose.prod.yml up -d --build`
- **Stop**: `docker compose -f docker-compose.prod.yml down`
