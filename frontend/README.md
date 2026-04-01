# AI Operations Manager Frontend

A modern Next.js UI built to interface with the Multi-Agent System backend.

## Architecture & Technology Stack

*   **Framework:** Next.js 14+ (App Router)
*   **Styling:** Tailwind CSS (`@tailwindcss/typography`)
*   **State Management:** Zustand (Global State)
*   **API Client:** Axios
*   **Animations:** Framer Motion
*   **Markdown:** `react-markdown` (Renders AI Chat responses)
*   **Notifications:** `react-hot-toast` (Non-blocking alerts)
*   **Icons:** `lucide-react`

## Directory Structure

```
frontend/
├── app/                  # Next.js App Router
│   ├── layout.tsx        # Global Layout (contains ToastProvider)
│   ├── page.tsx          # Main Dashboard
│   └── globals.css       # Tailwind CSS Entry
├── components/           # React Components
│   ├── ChatWindow.tsx    # Interactive AI Chat Interface
│   ├── NotesList.tsx     # Displays AI-Summarized Notes
│   ├── TaskList.tsx      # Displays & Completes Tasks
│   └── WorkflowVisualizer.tsx # Animated Multi-Agent Flow Diagram
├── lib/                  # Utilities & API
│   ├── api.ts            # Axios configuration & API endpoints
│   └── store.ts          # Zustand state store
└── .env.example          # Environment variables template
```

## Running the Frontend

### Configuration
1. Create a `.env` file from the example:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:8080
   ```

2. **Note:** The Next.js frontend is configured to run on port `3000` by default. Our execution scripts (`run_local.sh`/`.bat`) automatically handle this.

### Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

## Key Features

1.  **AI Chat:** Located in `components/ChatWindow.tsx`, the Chat Interface sends natural language requests to the backend Orchestrator agent. It properly handles and styles Markdown text returned by Vertex AI.
2.  **Interactive Task Management:** `components/TaskList.tsx` retrieves tasks from BigQuery (via the backend) and supports striking through/completing tasks interactively. The optimistic UI provides instant feedback while syncing with the backend in the background.
3.  **Real-time Workflow Visualization:** `components/WorkflowVisualizer.tsx` visually illustrates the Multi-Agent System routing process as requests move from the Orchestrator to specialized sub-agents.

## Deployment

We recommend deploying the frontend to **Vercel** for the simplest integration with Next.js, though it can also be exported and served via Firebase Hosting or another Google Cloud Run instance. Ensure you update your `NEXT_PUBLIC_API_URL` environment variable within your deployment provider's dashboard to point to your live backend endpoint.
