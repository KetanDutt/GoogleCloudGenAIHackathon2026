from playwright.sync_api import sync_playwright
import os
import glob

def run_cuj(page):
    page.goto("http://localhost:3000")
    page.wait_for_timeout(3000)

    # Check that dashboard health text is visible
    try:
        page.wait_for_selector("text=System Status", timeout=5000)
        page.wait_for_selector("text=BigQuery:", timeout=5000)
        page.wait_for_selector("text=Vertex AI:", timeout=5000)
    except Exception as e:
        print(f"Elements not found: {e}")

    # Take screenshot at the key moment
    page.screenshot(path="/home/jules/verification/screenshots/dashboard_health.png")
    page.wait_for_timeout(2000)  # Hold final state for the video

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos",
            viewport={'width': 1280, 'height': 720}
        )
        page = context.new_page()
        try:
            run_cuj(page)
        finally:
            context.close()  # MUST close context to save the video
            browser.close()

    # Rename the video file to a known name
    videos = glob.glob('/home/jules/verification/videos/*.webm')
    if videos:
        os.rename(videos[0], '/home/jules/verification/videos/dashboard_health.webm')
