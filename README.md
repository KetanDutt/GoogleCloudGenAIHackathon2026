# AI Personal Operations Manager (Multi-Agent System)

An intelligent, multi-agent AI system built for the Google Cloud GenAI Hackathon 2026. This application uses an Orchestrator agent to dynamically route user inputs (via chat) to specialized sub-agents (Planner, Calendar, Notes, Reminder) to manage daily operations.

## 🌟 Key Features

*   **Multi-Agent Architecture:** A central Orchestrator agent delegates tasks to specialized sub-agents using Vertex AI (Gemini 1.5-flash).
*   **Intelligent Routing:** Chat interface understands intent and can break goals down into actionable tasks, summarize meeting notes, or schedule calendar events.
*   **Google Cloud Integration:**
    *   **Vertex AI:** Powers all LLM agent reasoning.
    *   **BigQuery:** Stores tasks, notes, and calendar events securely.
    *   **Cloud Run:** The backend is fully containerized and deployment-ready.
*   **Modern Frontend:** Built with Next.js (App Router), Tailwind CSS, Framer Motion for animations, and Zustand for state management. Features an interactive chat and a live Workflow Visualizer.
*   **Asynchronous Processing:** The FastAPI backend uses `asyncio.to_thread` to wrap synchronous GCP SDK calls, ensuring high performance without blocking the event loop.
*   **Resilient Fallbacks:** Even without Google Cloud credentials, the backend uses mock responses for local testing and demonstration.

---

## 🏗️ System Architecture

### 1. Frontend (`/frontend`)
*   **Framework:** Next.js (React)
*   **Styling:** Tailwind CSS, `@tailwindcss/typography`
*   **State:** Zustand
*   **Communication:** Axios (communicates with FastAPI backend)

### 2. Backend (`/backend`)
*   **Framework:** FastAPI (Python 3.10+)
*   **Agents:**
    *   `orchestrator.py`: Classifies user intent.
    *   `planner.py`: Breaks down large goals into bulleted tasks.
    *   `calendar.py`: Suggests realistic datetimes for tasks.
    *   `notes.py`: Summarizes text and extracts action items.
    *   `reminder.py`: Identifies urgency and suggests reminders.
*   **Tools (MCP-style):** Interact with BigQuery (`task_tools.py`, `notes_tools.py`, `calendar_tools.py`).

---

## 🚀 Quick Start (Local Setup)

We have provided automated scripts to handle virtual environments, dependency installation, and running both servers simultaneously.

### Prerequisites
*   Python 3.10+
*   Node.js (npm)
*   (Optional) Google Cloud SDK (`gcloud`)

### On Windows
1. Open a Command Prompt or PowerShell in the root directory.
2. Run the local setup script:
   ```cmd
   run_local.bat
   ```
3. The script will create `.env` files from `.env.example`, install `pip` and `npm` dependencies, and start:
   * Backend: http://localhost:8080
   * Frontend: http://localhost:3000

### On macOS / Linux
1. Open a terminal in the root directory.
2. Make the scripts executable (if they aren't already):
   ```bash
   chmod +x run_local.sh deploy_gcp.sh
   ```
3. Run the local setup script:
   ```bash
   ./run_local.sh
   ```

---

## ☁️ Deployment (Google Cloud)

To deploy the backend to Google Cloud Run:

1. Authenticate with the Google Cloud CLI:
   ```bash
   gcloud auth login
   ```
2. Open `deploy_gcp.bat` (Windows) or `deploy_gcp.sh` (macOS/Linux) and update the `PROJECT_ID` variable with your actual Google Cloud Project ID.
3. Run the deployment script:
   * **Windows:** `deploy_gcp.bat`
   * **macOS/Linux:** `./deploy_gcp.sh`
4. The script will configure your project, enable the necessary APIs (Cloud Build, Cloud Run, Vertex AI, BigQuery), and deploy the FastAPI backend.
5. **Frontend Deployment:** Deploy the `/frontend` directory to Vercel, Netlify, or another Cloud Run instance. Ensure you set the `NEXT_PUBLIC_API_URL` environment variable to the newly generated Cloud Run backend URL.

---

## 🧪 Sample Inputs to Test

Try these phrases in the chat interface:
*   *"Plan my week for exams"* (Triggers Planner & Calendar agents)
*   *"Summarize this meeting: We discussed the new marketing strategy and decided John will lead the campaign starting next Monday."* (Triggers Notes agent)
*   *"Add task: finish project by Friday"* (Triggers Planner/Orchestrator)
*   *"I have an important doctor's appointment tomorrow at 10am"* (Triggers Reminder/Calendar agent)

## 📁 Repository Structure

*   `/backend` - FastAPI server, LLM Agents, Tools, and GCP Client services.
*   `/frontend` - Next.js UI, Dashboard, Chat Interface, and API client.
*   `run_local.*` - Local development orchestration scripts.
*   `deploy_gcp.*` - Google Cloud Run deployment scripts.
