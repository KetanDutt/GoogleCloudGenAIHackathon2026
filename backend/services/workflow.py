import json
import asyncio
import logging
from typing import Dict, Any

from models.schemas import ChatRequest, ChatResponse
from agents.orchestrator import route_user_input
from agents.planner import generate_tasks
from agents.calendar import schedule_task
from agents.notes import summarize_and_extract
from agents.reminder import assess_urgency

from tools.task_tools import add_task
from tools.notes_tools import save_note
from tools.calendar_tools import schedule_event
from tools.reminder_tools import save_reminder

logger = logging.getLogger(__name__)

async def process_chat_workflow(request: ChatRequest, current_user: str) -> ChatResponse:
    """
    Main workflow engine. Routes user input and processes it through specialized agents asynchronously.
    """
    user_input = request.user_input
    user_id = current_user
    model_name = request.model_name

    trace = [{"step": "User Input", "details": f"[{model_name}] {user_input}"}]

    try:
        # 1. Orchestrate
        intent = await asyncio.to_thread(route_user_input, user_input, model_name)
        trace.append({"step": "Orchestrator", "details": f"Routed to {intent} agent"})
    except Exception as e:
        logger.error(f"Orchestrator failed: {e}")
        intent = "unknown"
        trace.append({"step": "Orchestrator", "details": f"Failed to classify intent: {e}"})
        return ChatResponse(intent=intent, response={"message": "Could not determine intent."}, trace=trace)

    response_data = {}

    try:
        if intent == "planner":
            # Generate tasks
            trace.append({"step": "Agent Processing", "details": "Planner agent generating tasks..."})
            tasks = await asyncio.to_thread(generate_tasks, user_input, model_name)
            scheduled_tasks = []

            for task_name in tasks:
                # Schedule each task via calendar agent
                trace.append({"step": "Agent Processing", "details": f"Calendar agent scheduling task: {task_name}"})
                try:
                    time_suggestion = await asyncio.to_thread(schedule_task, task_name, model_name)
                    start_time = time_suggestion.get("start_time")
                    end_time = time_suggestion.get("end_time")
                except Exception as e:
                    logger.error(f"Calendar scheduling failed for task '{task_name}': {e}")
                    start_time = "Unknown"
                    end_time = "Unknown"

                # Store in BigQuery
                trace.append({"step": "Tool Execution", "details": "Adding task and event to database"})
                await asyncio.to_thread(add_task, user_id, task_name, start_time)
                if start_time != "Unknown":
                    await asyncio.to_thread(schedule_event, user_id, task_name, start_time, end_time)

                scheduled_tasks.append({
                    "task": task_name,
                    "scheduled_start": start_time,
                    "scheduled_end": end_time
                })

            trace.append({"step": "Database Sync", "details": f"Saved {len(scheduled_tasks)} scheduled tasks"})
            response_data = {"tasks_created": scheduled_tasks}

        elif intent == "notes":
            # Summarize and extract
            trace.append({"step": "Agent Processing", "details": "Notes agent summarizing and extracting action items..."})
            extracted = await asyncio.to_thread(summarize_and_extract, user_input, model_name)
            summary = extracted.get("summary")
            action_items = extracted.get("action_items", [])

            action_items_str = json.dumps(action_items)

            # Save notes
            trace.append({"step": "Tool Execution", "details": "Saving note to database"})
            await asyncio.to_thread(save_note, user_id, user_input, summary, action_items_str)
            trace.append({"step": "Database Sync", "details": "Note saved successfully"})

            response_data = {
                "summary": summary,
                "action_items": action_items
            }

        elif intent == "calendar":
            # Schedule a single event
            trace.append({"step": "Agent Processing", "details": "Calendar agent suggesting times..."})
            time_suggestion = await asyncio.to_thread(schedule_task, user_input, model_name)
            start_time = time_suggestion.get("start_time")
            end_time = time_suggestion.get("end_time")

            trace.append({"step": "Tool Execution", "details": "Saving event to database"})
            await asyncio.to_thread(schedule_event, user_id, user_input, start_time, end_time)
            trace.append({"step": "Database Sync", "details": "Event saved successfully"})

            response_data = {
                "event_scheduled": user_input,
                "start_time": start_time,
                "end_time": end_time
            }

        elif intent == "reminder":
            trace.append({"step": "Agent Processing", "details": "Reminder agent assessing urgency..."})
            urgency_data = await asyncio.to_thread(assess_urgency, user_input, model_name)

            urgency = urgency_data.get("urgency_level")
            suggestion = urgency_data.get("reminder_suggestion")

            trace.append({"step": "Tool Execution", "details": "Saving reminder to database"})
            await asyncio.to_thread(save_reminder, user_id, user_input, urgency, suggestion)
            trace.append({"step": "Database Sync", "details": "Reminder saved successfully"})

            response_data = {
                "reminder_set_for": user_input,
                "urgency": urgency,
                "suggestion": suggestion
            }
        else:
            intent = "unknown"
            trace.append({"step": "Orchestrator", "details": "Could not classify intent."})
            response_data = {"message": "Could not determine intent."}

    except Exception as e:
        logger.error(f"Error during workflow execution: {e}")
        intent = "error"
        trace.append({"step": "Error", "details": str(e)})
        response_data = {"error": "An error occurred while processing your request.", "details": str(e)}

    return ChatResponse(intent=intent, response=response_data, trace=trace)
