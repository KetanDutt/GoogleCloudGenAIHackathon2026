@echo off
echo ==================================================
echo Starting AI Personal Operations Manager (Local)
echo ==================================================

echo.
echo [1/3] Setting up Backend...
cd backend
if not exist venv (
    echo Creating virtual environment...
    python -m venv venv
)
call venv\Scripts\activate.bat
echo Installing backend dependencies...
pip install -r requirements.txt
start "Backend" cmd /c "uvicorn main:app --reload --port 8080"
cd ..

echo.
echo [2/3] Setting up Frontend...
cd frontend
echo Installing frontend dependencies...
call npm install
start "Frontend" cmd /c "npm run dev"
cd ..

echo.
echo [3/3] System is running!
echo Backend: http://localhost:8080
echo Frontend: http://localhost:3000
echo.
echo Close the command windows to stop the servers.
pause
