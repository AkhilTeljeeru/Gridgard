# GridGuard AI – Windows 11 PowerShell Local Setup Guide

This guide walks you through executing GridGuard AI locally on **Windows 11** using PowerShell 7+ or Windows Terminal.

---

## 1. Prerequisites Checklist
Ensure the following tools are installed on your Windows 11 workstation:
- **Git for Windows**: Run `git --version`
- **Docker Desktop**: With WSL2 backend enabled. Run `docker compose version`
- **Node.js 20+ (LTS)**: Run `node -v` and `npm -v`
- **PowerShell 7+** (Recommended) or Windows PowerShell 5.1

---

## 2. Step-by-Step Installation

### Step 1: Open PowerShell as Administrator / Standard User
Open **Windows Terminal** and start a PowerShell prompt:
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Step 2: Clone or Navigate to Project
```powershell
cd C:\Projects
git clone <repository-url> gridguard-ai
cd gridguard-ai
```

### Step 3: Initialize Environment Variables
```powershell
Copy-Item .env.example .env
```

### Step 4: Boot Database & Graph Infrastructure
Launch the local PostgreSQL 16 and Neo4j 5.18 containers:
```powershell
docker compose up -d postgres neo4j
```

Verify that the containers are healthy:
```powershell
docker compose ps
```

You can access the native interfaces:
- **PostgreSQL**: `localhost:5432` (User: `gridguard`, DB: `gridguard_db`)
- **Neo4j Browser**: `http://localhost:7474` (User: `neo4j`, Password: `gridguard_graph_2026`)

### Step 5: Install App Dependencies & Start Dev Server
```powershell
npm install
npm run dev
```

### Step 6: Access the Application
Open your browser to:
```
http://localhost:3000
```

---

## 3. Verification & Troubleshooting Commands

### Check PostgreSQL Schema Initialization:
```powershell
docker exec -it gridguard_postgres psql -U gridguard -d gridguard_db -c "\dt"
```

### Execute Test Neo4j Cypher Query:
```powershell
docker exec -it gridguard_neo4j cypher-shell -u neo4j -p gridguard_graph_2026 "MATCH (n) RETURN count(n) as node_count;"
```

### View Live Logs:
```powershell
docker compose logs -f postgres
```
