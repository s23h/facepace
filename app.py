import io
from flask import Flask, request, jsonify
import os
from mistralai import Mistral
import sys
import cv2
import time
import json
import scipy
from scipy.signal import find_peaks
import numpy as np
from pathlib import Path
from yarppg.rppg.rppg import RPPG
from yarppg.rppg.roi.roi_detect import FaceMeshDetector
from yarppg.rppg.processors import LiCvprProcessor
from yarppg.rppg.hr import from_peaks
from yarppg.rppg.hr import HRCalculator
from yarppg.rppg.filters import get_butterworth_filter
import requests
import tempfile
from supabase import create_client, Client

NEXT_PUBLIC_SUPABASE_URL="https://xswosfqzsvllwgkyaivz.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhzd29zZnF6c3ZsbHdna3lhaXZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjgxMjEwMzksImV4cCI6MjA0MzY5NzAzOX0.Y6Bj8jdV9eEpLVMnQ56wAaXsbMry80zFH14snD9SRTI"
supabase: Client = create_client(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)

def log_to_supabase(data):
    try:
        response = supabase.table("health_metrics").insert(data).execute()
        print("Data inserted successfully:", response.data)
    except Exception as e:
        print("Error inserting data to Supabase:", str(e))

def detect_eyes(frame):
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (7, 7), 0)
    thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY_INV, 11, 2)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    eye_regions = []
    for contour in contours:
        x, y, w, h = cv2.boundingRect(contour)
        aspect_ratio = w / float(h)
        if 1000 < cv2.contourArea(contour) < 5000 and 0.5 < aspect_ratio < 2.0:
            eye_regions.append((x, y, w, h))
    return eye_regions

def detect_pupil(eye_region):
    _, thresh = cv2.threshold(eye_region, 30, 255, cv2.THRESH_BINARY_INV)
    contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    if contours:
        pupil = max(contours, key=cv2.contourArea)
        return pupil
    return None

def analyze_eye_movements(video_path):
    cap = cv2.VideoCapture(video_path)
    pupil_sizes = []
    eye_positions = []
    frame_count = 0
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        frame_count += 1
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        eye_regions = detect_eyes(frame)
        for (x, y, w, h) in eye_regions:
            eye_region = gray[y:y+h, x:x+w]
            pupil = detect_pupil(eye_region)
            if pupil is not None:
                pupil_size = cv2.contourArea(pupil)
                pupil_sizes.append(pupil_size)
                M = cv2.moments(pupil)
                if M["m00"] != 0:
                    cx = int(M["m10"] / M["m00"])
                    cy = int(M["m01"] / M["m00"])
                    eye_positions.append((cx + x, cy + y))
    cap.release()
    return pupil_sizes, eye_positions, frame_count

def analyze_pupil_dynamics(pupil_sizes):
    mean_size = np.mean(pupil_sizes)
    std_size = np.std(pupil_sizes)
    min_size = np.min(pupil_sizes)
    max_size = np.max(pupil_sizes)
    coefficient_of_variation = (std_size / mean_size) * 100
    baseline = np.percentile(pupil_sizes, 10)
    max_dilation = max_size / baseline
    response_amplitude = max_size - baseline
    return {
        "mean_size": mean_size,
        "std_size": std_size,
        "min_size": min_size,
        "max_size": max_size,
        "coefficient_of_variation": coefficient_of_variation,
        "max_dilation": max_dilation,
        "response_amplitude": response_amplitude
    }

def analyze_eye_movements_advanced(eye_positions, frame_rate):
    if not eye_positions:
        return {}
    distances = [np.linalg.norm(np.array(eye_positions[i]) - np.array(eye_positions[i-1])) 
                 for i in range(1, len(eye_positions))]
    velocities = [d * frame_rate for d in distances]
    saccade_threshold = np.percentile(velocities, 90)
    saccades = [v for v in velocities if v > saccade_threshold]
    fixation_threshold = np.percentile(velocities, 10)
    fixations = [v for v in velocities if v < fixation_threshold]
    saccadic_peak_velocity = max(velocities) if velocities else 0
    fixation_stability = np.std(fixations) if fixations else 0
    fixation_durations = [1/v for v in fixations] if fixations else []
    fixation_duration_variability = np.std(fixation_durations) if fixation_durations else 0
    return {
        "estimated_saccades": len(saccades),
        "estimated_fixations": len(fixations),
        "mean_saccade_velocity": np.mean(saccades) if saccades else 0,
        "mean_fixation_velocity": np.mean(fixations) if fixations else 0,
        "saccadic_peak_velocity": saccadic_peak_velocity,
        "fixation_stability_index": fixation_stability,
        "fixation_duration_variability": fixation_duration_variability
    }

def analyze_gaze_dispersion(eye_positions):
    if not eye_positions:
        return {}
    x_coords, y_coords = zip(*eye_positions)
    x_dispersion = np.std(x_coords)
    y_dispersion = np.std(y_coords)
    total_dispersion = np.sqrt(x_dispersion**2 + y_dispersion**2)
    return {
        "x_dispersion": x_dispersion,
        "y_dispersion": y_dispersion,
        "total_dispersion": total_dispersion
    }

def analyze_pupil_response_time(pupil_sizes, frame_rate):
    diff = np.diff(pupil_sizes)
    max_change_index = np.argmax(np.abs(diff))
    response_time = max_change_index / frame_rate
    return response_time

def get_pupil_data(video_url):
    cap = cv2.VideoCapture(video_url)
    frame_rate = cap.get(cv2.CAP_PROP_FPS)
    cap.release()
    
    pupil_sizes, eye_positions, total_frames = analyze_eye_movements(video_url)

    results = {
        "pupil_dynamics": analyze_pupil_dynamics(pupil_sizes),
        "eye_movements": analyze_eye_movements_advanced(eye_positions, frame_rate),
        "gaze_dispersion": analyze_gaze_dispersion(eye_positions),
        "pupil_response_time": analyze_pupil_response_time(pupil_sizes, frame_rate),
        "total_frames": total_frames
    }

    # Convert numpy types to Python native types for JSON serialization
    def convert_to_serializable(obj):
        if isinstance(obj, np.integer):
            return int(obj)
        elif isinstance(obj, np.floating):
            return float(obj)
        elif isinstance(obj, np.ndarray):
            return obj.tolist()
        return obj

    # Serialize the results to JSON
    json_results = json.dumps(results, indent=2)

    return json_results

def calculate_hrv(ts, vs):
    # Find R-peaks using scipy's find_peaks function
    r_peaks, _ = find_peaks(vs, distance=int(len(vs)/10))  # Adjust distance as needed
    
    # Calculate RR intervals in milliseconds
    rr_intervals = np.diff(ts[r_peaks]) * 1000  # Convert to milliseconds
    
    # Calculate various HRV metrics
    sdnn = np.std(rr_intervals)  # in milliseconds
    rmssd = np.sqrt(np.mean(np.square(np.diff(rr_intervals))))  # in milliseconds
    nn50 = sum(np.abs(np.diff(rr_intervals)) > 50)  # count
    pnn50 = (nn50 / len(rr_intervals)) * 100  # percentage
    
    return sdnn, rmssd, nn50, pnn50

def process_video(video_url, output_path):
    # Initialize components
    roi_detector = FaceMeshDetector()
    processor = LiCvprProcessor()
    rppg = RPPG(roi_detector)
    rppg.add_processor(processor)
    # Download video content and save to a temporary file
    with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as temp_file:
        try:
            response = requests.get(video_url, stream=True, verify=False)
            response.raise_for_status()  # Raise an exception for bad status codes
        except requests.exceptions.RequestException as e:
            print(f"Error: Failed to download video. {str(e)}")
            return

        for chunk in response.iter_content(chunk_size=8192):
            temp_file.write(chunk)
        
        temp_file_path = temp_file.name


    # Use cv2.VideoCapture with the temporary file
    cap = cv2.VideoCapture(temp_file_path)
    if not cap.isOpened():
        print("Error: Could not open downloaded video")
        os.unlink(temp_file_path)
        return
    
    # Rest of the function remains the same
    cap.set(cv2.CAP_PROP_AUTO_WB, 0)
    cap.set(cv2.CAP_PROP_AUTO_EXPOSURE, 0.25)  # 0.25 means manual mode

    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))

    if width > 3800 or height > 3800:
        digital_lowpass = get_butterworth_filter(fps, 1.5, order=4)
        hr_calc = HRCalculator(update_interval=int(fps), winsize=int(fps*15),
                            filt_fun=lambda vs: [digital_lowpass(v) for v in vs]) 
    elif fps > 45:
        digital_lowpass = get_butterworth_filter(fps, 1.11, order=5)
        hr_calc = HRCalculator(update_interval=int(fps), winsize=int(fps*10),
                            filt_fun=lambda vs: [digital_lowpass(v) for v in vs])
    else:
        digital_lowpass = get_butterworth_filter(fps, 0.32, order=7)
        hr_calc = HRCalculator(update_interval=int(fps*10), winsize=int(fps*30),
                            filt_fun=lambda vs: [digital_lowpass(v) for v in vs])     

    # Process video frames
    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        rppg.on_frame_received(frame_rgb)

        # Update HR calculation
        hr_calc.update(rppg)

    # Calculate final heart rate
    vs = list(rppg.get_vs())[0]  # Get the first (and only) processor's data
    ts = rppg.get_ts()
    
    # Apply digital lowpass filter element-wise
    filtered_vs = np.array([digital_lowpass(v) for v in vs])
    
    # Normalize filtered_vs
    filtered_vs = (filtered_vs - np.mean(filtered_vs)) / (np.std(filtered_vs) + 1e-10)
    sdnn, rmssd, nn50, pnn50 = calculate_hrv(np.array(ts), np.array(vs))
    
    # Try primary heart rate calculation
    hr = hr_calc.hr_fun(filtered_vs, ts)
    
    if np.isnan(hr) or hr == 0 or hr > 180:  # Added check for unreasonably high HR
        
        # Method 1: Peak detection with stricter parameters
        peaks, _ = scipy.signal.find_peaks(filtered_vs, distance=int(fps/3), prominence=0.1)  # Adjusted parameters
        if len(peaks) > 1:
            hr = from_peaks(peaks, ts)
        
        # Method 2: FFT-based method with narrower frequency range
        if np.isnan(hr) or hr == 0 or hr > 180:
            fft = np.fft.fft(filtered_vs)
            frequencies = np.fft.fftfreq(len(ts), ts[1] - ts[0])
            positive_freq_idx = np.where((frequencies > 0.75) & (frequencies < 2.5))  # 45-150 bpm range
            peak_freq = frequencies[positive_freq_idx][np.argmax(np.abs(fft[positive_freq_idx]))]
            hr = peak_freq * 60
        
        # Method 3: Average time between peaks with additional filtering
        if np.isnan(hr) or hr == 0 or hr > 180:
            peaks, _ = scipy.signal.find_peaks(filtered_vs, distance=int(fps/3), prominence=0.1)
            if len(peaks) > 2:
                peak_intervals = np.diff(ts[peaks])
                # Filter out intervals that would result in unreasonable heart rates
                valid_intervals = peak_intervals[(peak_intervals > 0.4) & (peak_intervals < 1.5)]
                if len(valid_intervals) > 0:
                    avg_peak_distance = np.mean(valid_intervals)
                    hr = 60 / avg_peak_distance
    
    # If all methods fail or produce unreasonable results, set a default value
    if np.isnan(hr) or hr == 0 or hr > 180:
        hr = 0

    cap.release()
    return hr, sdnn, rmssd, nn50, pnn50

app = Flask(__name__)

@app.route('/')
def index():
    return "Hello world"

import concurrent.futures
from concurrent.futures import ThreadPoolExecutor

@app.route('/pixtral_get_age', methods=['POST'])
def pixtral_get_age():
    data = request.get_json()
    image_url = data.get('image_url')
    video_url = data.get('video_url')
    chron_age = data.get('age')

    print(image_url, video_url, chron_age)

    mistral = Mistral(api_key="pqmKVrIjJjkKQMhvRslPapP7QzNV2A1I")

    # Define functions to be executed concurrently
    def get_pupil_data_async():
        return json.loads(get_pupil_data(video_url))

    def process_video_async():
        return process_video(video_url, "data.npz")

    def mistral_chat_async(pupil_data, heart_data):
        combined_prompt = f"""
        Analyze the following data and image, then output a JSON object with the following structure:

        {{
            "heart_info": "Short blurb (1 sentence) explaining their heart health in the second person based on {heart_data}",
            "sdnn_info": "Short blurb (1 sentence) explaining their Standard Deviation of NN intervals ({heart_data['sdnn']}) in the second person",
            "rmssd_info": "Short blurb (1 sentence) explaining their Root Mean Square of Successive Differences ({heart_data['rmssd']}) in the second person",
            "nn50_info": "Short blurb (1 sentence) explaining the number of adjacent NN intervals that differ by more than 50 milliseconds ({heart_data['nn50']}) in the second person",
            "pnn50_info": "Short blurb (1 sentence) explaining the percentage of NN intervals that differ by more than 50 milliseconds ({heart_data['pnn50']}) in the second person",
            "age": "Estimated age as a single positive integer",
            "acne": {{
                "score": "Acne score on a scale of 1-10 (1 = severe acne, 10 = no acne)",
                "description": "Brief description of acne presence, severity, and location"
            }},
            "eye_bags": {{
                "score": "Eye bags score on a scale of 1-10 (1 = very poor sleep, 10 = very good sleep)",
                "description": "Brief description of eye bags presence and severity"
            }},
            "brain_health": {{
                "description": "Two-sentence description (using pupin coefficent of variation, estimated saccades, estimated fixations all shaved to two decimal places) of brain/cognitive health. This should be personal and give insight into cognitive function. based on the following pupil data: {pupil_data}"
            }}
        }}

        Ensure all text fields are concise and do not exceed the specified sentence count. The age should be a single integer, and scores should be integers between 1 and 10.
        """

        response = mistral.chat.complete(
            model="pixtral-12b",
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": combined_prompt},
                        {"type": "image_url", "image_url": image_url}
                    ]
                }
            ],
            response_format = {
                "type": "json_object",
            }
        )
        return json.loads(response.choices[0].message.content)

    # Execute functions concurrently
    with ThreadPoolExecutor(max_workers=3) as executor:
        pupil_data_future = executor.submit(get_pupil_data_async)
        process_video_future = executor.submit(process_video_async)

        # Wait for pupil_data and process_video to complete
        pupil_data = pupil_data_future.result()
        hr, sdnn, rmssd, nn50, pnn50 = process_video_future.result()

        # Prepare heart_data for mistral_chat
        heart_data = {
            "sdnn": float(sdnn),
            "rmssd": float(rmssd),
            "nn50": float(nn50),
            "pnn50": float(pnn50)
        }

        # Now execute mistral_chat with the results
        mistral_output_future = executor.submit(mistral_chat_async, pupil_data, heart_data)
        mistral_output = mistral_output_future.result()

    # Calculate pace of aging
    functional_age = int(mistral_output['age'])
    pace_of_aging = functional_age / float(chron_age)

    hr = float(hr)
    if hr < 45: hr = 45
    if hr > 100: hr = 98
    # Construct the final response
    response_data = {
        'functional_age': functional_age,
        'pace_of_aging': pace_of_aging,
        'age_differential': str(int(chron_age)-int(functional_age)) + " years younger" if int(chron_age) >= int(functional_age) else str(int(functional_age)-int(chron_age)) + " years older",
        'hr': float(hr),
        'heart_info': mistral_output['heart_info'],
        'sdnn': float(sdnn),
        'sdnn_info': mistral_output['sdnn_info'],
        'rmssd': float(rmssd),
        'rmssd_info': mistral_output['rmssd_info'],
        'nn50': float(nn50),
        'nn50_info': mistral_output['nn50_info'],
        'pnn50': float(pnn50),
        'pnn50_info': mistral_output['pnn50_info'],
        'acne': mistral_output['acne'],
        'eye_bags': mistral_output['eye_bags'],
        'brain_health': mistral_output['brain_health'],
        'coefficent_pupil_variation': str(pupil_data["pupil_dynamics"]["coefficient_of_variation"]),
        "estimated_saccades_fixations": int(int(pupil_data["eye_movements"]["estimated_saccades"])+int(pupil_data["eye_movements"]["estimated_fixations"]))
    }
    log_to_supabase(response_data)

    print(response_data)
    return jsonify(response_data), 200
    
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)