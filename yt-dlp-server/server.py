import os
import time  # We need to import the time module for sleep
import subprocess
from flask import Flask, render_template, request, Response

# --- Configuration ---
DOWNLOAD_DIR = "downloads"
if not os.path.exists(DOWNLOAD_DIR):
    os.makedirs(DOWNLOAD_DIR)

app = Flask(__name__)

# --- NEW: Simulation Function ---
def simulate_yt_dlp_download():
    """
    A generator function that simulates the output of a yt-dlp download.
    It yields lines of text with delays to mimic a real process.
    """
    yield "🚀 SIMULATION MODE ACTIVATED 🚀\n"
    yield "Running command: yt-dlp --format worstaudio ... https://www.youtube.com/watch?v=dQw4w9WgXcQ\n\n"
    time.sleep(0.5)

    yield "[youtube] Extracting URL: https://www.youtube.com/watch?v=dQw4w9WgXcQ\n"
    time.sleep(0.3)
    yield "[youtube] dQw4w9WgXcQ: Downloading webpage\n"
    time.sleep(0.4)
    yield "[info] dQw4w9WgXcQ: Downloading 1 format(s): 251\n"
    time.sleep(0.2)
    yield '[download] Destination: downloads/Simulated Rick Astley Video.webm\n'
    time.sleep(0.5)

    # Simulate the progress bar
    for i in range(101):
        # The '\r' at the end tells the terminal to return to the start of the line.
        # Browsers will just print this on a new line, which is fine for our simulation.
        progress_line = f"[download]  {i:3.1f}% of ~3.30MiB at 750.00KiB/s ETA 00:02\r"
        yield progress_line
        time.sleep(0.03) # 30ms delay between progress updates

    yield "\n[download] 100% of 3.30MiB in 00:04\n"
    time.sleep(0.5)

    yield "[Merger] Merging formats into \"downloads/Simulated Rick Astley Video.m4a\"\n"
    time.sleep(0.3)
    yield "Deleting original file downloads/Simulated Rick Astley Video.webm (pass -k to keep)\n"
    time.sleep(0.2)

    yield "\n\n--- PROCESS FINISHED (SIMULATION) ---"
    yield "\n✅ Success! Download completed."


# --- The REAL yt-dlp Command Function (Unchanged) ---
def run_yt_dlp(url):
    """
    Runs the specified yt-dlp command as a subprocess and yields its output line by line.
    """
    command = [
        'yt-dlp',
        '--format', 'worstaudio[format_note*=low]',
        '--concurrent-fragments', '32',
        '--extractor-args', 'youtube:player_client=ios',
        '--retry-sleep', 'fragment:exp=1:5',
        '-o', os.path.join(DOWNLOAD_DIR, '%(title)s.%(ext)s'),
        url
    ]
    
    process = subprocess.Popen(
        command,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        encoding='utf-8',
        errors='replace',
        bufsize=1
    )

    yield f"🚀 Running command: {' '.join(command)}\n\n"
    for line in iter(process.stdout.readline, ''):
        yield line
    
    process.wait()
    return_code = process.returncode
    
    yield f"\n\n--- PROCESS FINISHED ---"
    if return_code == 0:
        yield "\n✅ Success! Download completed."
    else:
        yield f"\n❌ Error! Process exited with code: {return_code}"

# --- Flask Routes ---
@app.route('/')
def index():
    """Renders the main HTML page."""
    return render_template('index.html')

@app.route('/download', methods=['POST'])
def download():
    """
    Handles the form submission.
    Checks for the 'simulate' keyword to run the simulation,
    otherwise runs the real download.
    """
    url = request.form.get('url')
    if not url:
        return Response("URL is required.", status=400)

    # --- MODIFIED: Logic to switch between real and simulated download ---
    if url.strip().lower() == 'simulate':
        # If the user typed 'simulate', run the fake download
        return Response(simulate_yt_dlp_download(), mimetype='text/plain')
    else:
        # For any other URL, run the real download
        return Response(run_yt_dlp(url), mimetype='text/plain')

# --- Main Entry Point ---
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)