@echo off
echo ==================================================
echo Starting AI Personal Operations Manager (Local)
echo ==================================================

echo.
echo [1/3] Setting up Backend...
cd backend
if not exist .env (
    echo Creating backend .env from .env.example...
    copy .env.example .env
)
if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
)
call venv\Scripts\activate.bat
echo Installing backend dependencies...
pip install -r requirements.txt

REM Read PORT from .env if it exists, default to 8080
set APP_PORT=8080
if exist .env (
    for /f "tokens=1,2 delims==" %%A in (.env) do (
        if "%%A"=="PORT" set APP_PORT=%%B
    )
)

start "Backend" cmd /c "uvicorn main:app --reload --port %APP_PORT%"
cd ..

echo.
echo [2/3] Setting up Frontend...
cd frontend
if not exist .env (
    echo Creating frontend .env from .env.example...
    copy .env.example .env
)
echo Installing frontend dependencies...
call npm install
start "Frontend" cmd /c "npm run build && npm start"
cd ..

echo.
echo [3/3] System is running!
echo Backend: http://localhost:%APP_PORT%
echo Frontend: http://localhost:3000
echo.
echo Close the command windows to stop the servers.
pause
