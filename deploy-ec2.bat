@echo off
REM Deploy to EC2 Script for Windows
REM Run this from the project directory

SET EC2_HOST=ubuntu@47.128.66.132
SET KEY_FILE=workspace.pem
SET REMOTE_DIR=/opt/ai-friend-zone

echo ========================================
echo AI Digital Friend Zone - EC2 Deployment
echo ========================================
echo.

REM Step 1: Test connection
echo [1/5] Testing SSH connection...
ssh -i %KEY_FILE% -o StrictHostKeyChecking=no %EC2_HOST% "echo 'SSH Connected!'"
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Cannot connect to EC2. Check your key file and security group.
    exit /b 1
)
echo.

REM Step 2: Install Docker if needed
echo [2/5] Checking Docker installation...
ssh -i %KEY_FILE% %EC2_HOST% "docker --version || (sudo apt update && sudo apt install -y docker.io docker-compose && sudo systemctl start docker && sudo systemctl enable docker && sudo usermod -aG docker ubuntu)"
echo.

REM Step 3: Create directory and copy files
echo [3/5] Copying files to EC2...
ssh -i %KEY_FILE% %EC2_HOST% "sudo mkdir -p %REMOTE_DIR% && sudo chown ubuntu:ubuntu %REMOTE_DIR%"
scp -i %KEY_FILE% -r docker-compose.yml Dockerfile.frontend nginx server .env %EC2_HOST%:%REMOTE_DIR%/
echo.

REM Step 4: Start containers
echo [4/5] Starting Docker containers...
ssh -i %KEY_FILE% %EC2_HOST% "cd %REMOTE_DIR% && docker-compose down 2>/dev/null; docker-compose up -d --build"
echo.

REM Step 5: Show status
echo [5/5] Checking deployment status...
ssh -i %KEY_FILE% %EC2_HOST% "cd %REMOTE_DIR% && docker-compose ps"
echo.

echo ========================================
echo Deployment complete!
echo.
echo Access your app at: http://47.128.66.132:3000
echo API available at:   http://47.128.66.132:4000
echo ========================================
pause
