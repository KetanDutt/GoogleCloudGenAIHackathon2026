# AI Operations Manager Backend

The FastAPI-based Python backend for the Multi-Agent System.

## Architecture Overview

The backend is structured around a central Orchestrator that routes incoming natural language requests to specialized AI sub-agents. These agents leverage Vertex AI (Gemini 1.5-flash) to extract structured data (tasks, dates, summaries) from user prompts, which are then passed to "Tools" to act upon BigQuery data.

```
backend/
├── main.py                # FastAPI Application & Workflow Engine
├── agents/                # AI Agent Logic (Vertex AI prompts)
│   ├── orchestrator.py    # Classifies user intent (planner/calendar/notes/reminder)
│   ├── planner.py         # Breaks goals into bulleted tasks
│   ├── calendar.py        # Extracts/Suggests datetime objects
│   ├── notes.py           # Summarizes text and extracts action items
│   └── reminder.py        # Assesses task urgency
├── tools/                 # MCP-style Data Interaction Tools
│   ├── task_tools.py      # BigQuery queries for Tasks
│   ├── notes_tools.py     # BigQuery queries for Notes
│   └── calendar_tools.py  # BigQuery queries for Calendar Events
├── services/              # Third-party Integrations
│   ├── bigquery_client.py # Initializes the BigQuery client
│   └── vertex_client.py   # Initializes the Vertex AI (Gemini) client
├── models/                # Pydantic Schemas
│   └── schemas.py         # Request/Response validation models
└── config/                # Environment Settings
    └── settings.py        # Loads variables via python-dotenv/pydantic-settings
```

## Running the Backend

The backend is designed to run asynchronously. We wrap synchronous Google Cloud SDK calls (BigQuery and VertexAI) in `asyncio.to_thread` inside `main.py` to prevent blocking the FastAPI event loop.

### Configuration
1. Create a `.env` file based on `.env.example`:
   ```env
   GOOGLE_CLOUD_PROJECT=your-gcp-project-id
   GOOGLE_CLOUD_LOCATION=us-central1
   BIGQUERY_DATASET=ai_ops_manager
   PORT=8080
   ```

2. To run locally (with a virtual environment):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate.bat
   pip install -r requirements.txt
   uvicorn main:app --reload --port 8080
   ```

### Google Cloud Integration

The backend depends on two core GCP services:

1. **Vertex AI:** `services/vertex_client.py` uses the `gemini-1.5-flash` model. If authentication fails, the application falls back to a mock string response to prevent complete failure during demonstrations.
2. **BigQuery:** `services/bigquery_client.py` attempts to connect to the dataset specified in your `.env`. Like Vertex AI, it implements resilient mock responses (e.g., returning an empty list of tasks) if GCP credentials are not found.

## Deployment

A `Dockerfile` is included for containerized deployment to Google Cloud Run. Use the `deploy_gcp.sh` script in the root directory to handle the build and deployment process automatically.
