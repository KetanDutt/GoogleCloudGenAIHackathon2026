#!/bin/bash
set -e

echo "=================================================="
echo "Starting AI Personal Operations Manager (Local)"
echo "=================================================="

# Check for Python 3
if ! command -v python3 &> /dev/null
then
    echo "Python 3 is not installed. Please install it first."
    exit 1
fi

# Check for Node.js
if ! command -v npm &> /dev/null
then
    echo "npm is not installed. Please install Node.js first."
    exit 1
fi

echo -e "\n[1/3] Setting up Backend..."
cd backend
if [ ! -f ".env" ]; then
    echo "Creating backend .env from .env.example..."
    cp .env.example .env
fi

if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi
source venv/bin/activate
echo "Installing backend dependencies..."
pip install -r requirements.txt

# Start backend in background
echo "Starting FastAPI Backend..."
# Load port from .env if present
export $(grep -v '^#' .env | xargs)
PORT=${PORT:-8080}
uvicorn main:app --reload --port $PORT &
BACKEND_PID=$!
cd ..

echo -e "\n[2/3] Setting up Frontend..."
cd frontend
if [ ! -f ".env" ]; then
    echo "Creating frontend .env from .env.example..."
    cp .env.example .env
fi

echo "Installing frontend dependencies..."
npm install

# Start frontend in background
echo "Starting Next.js Frontend..."
npm run dev &
FRONTEND_PID=$!
cd ..

echo -e "\n[3/3] System is running!"
echo "Backend: http://localhost:$PORT"
echo "Frontend: http://localhost:3000"
echo "Press Ctrl+C to stop both servers."

# Trap SIGINT (Ctrl+C) to kill background processes cleanly
trap "echo -e '\nStopping servers...'; kill $BACKEND_PID $FRONTEND_PID; exit 0" SIGINT SIGTERM

# Wait indefinitely so the script doesn't exit
wait
