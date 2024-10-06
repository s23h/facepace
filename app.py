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

@app.route('/pixtral_get_age', methods=['POST'])
def pixtral_get_age():
    time.sleep(3)
    data = request.get_json()
    image_url = data.get('image_url')
    video_url = data.get('video_url')
    chron_age = data.get('age')

    print(image_url, video_url, chron_age)

    hr, sdnn, rmssd, nn50, pnn50 = process_video(video_url, "data.npz")
    hr = float(hr)
    sdnn = float(sdnn)
    rmssd = float(rmssd)
    nn50 = float(nn50)
    pnn50 = float(pnn50)
    print(hr)

    mistral = Mistral(api_key="pqmKVrIjJjkKQMhvRslPapP7QzNV2A1I")

    heart_data = f"Standard Deviation of NN intervals: {sdnn} and RMSSD: Root Mean Square of Successive Differences: {rmssd} and NN50: Number of successive differences greater than 50ms: {nn50} and pNN50: Percentage of NN50: {pnn50}"

    combined_prompt = f"""
    Analyze the following data and image, then output a JSON object with the following structure:

    {{
        "heart_info": "Short blurb (1 sentence) explaining their heart health in the second person based on {heart_data}",
        "sdnn_info": "Short blurb (1 sentence) explaining their Standard Deviation of NN intervals ({sdnn}) in the second person",
        "rmssd_info": "Short blurb (1 sentence) explaining their Root Mean Square of Successive Differences ({rmssd}) in the second person",
        "nn50_info": "Short blurb (1 sentence) explaining the number of adjacent NN intervals that differ by more than 50 milliseconds ({nn50}) in the second person",
        "pnn50_info": "Short blurb (1 sentence) explaining the percentage of NN intervals that differ by more than 50 milliseconds ({pnn50}) in the second person",
        "age": "Estimated age as a single positive integer",
        "acne": {{
            "score": "Acne score on a scale of 1-10 (1 = severe acne, 10 = no acne)",
            "description": "Brief description of acne presence, severity, and location"
        }},
        "eye_bags": {{
            "score": "Eye bags score on a scale of 1-10 (1 = very poor sleep, 10 = very good sleep)",
            "description": "Brief description of eye bags presence and severity"
        }},
    }}

    Ensure all text fields are concise and do not exceed one sentence each. The age should be a single integer, and scores should be integers between 1 and 10.
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

    try:
        mistral_output = json.loads(response.choices[0].message.content)
    except json.JSONDecodeError:
        return jsonify({'error': 'Failed to parse Mistral response'}), 500

    # Calculate pace of aging
    functional_age = int(mistral_output['age'])
    pace_of_aging = functional_age / float(chron_age)

    # Construct the final response
    response_data = {
        'functional_age': functional_age,
        'pace_of_aging': pace_of_aging,
        'age_differential': str(int(chron_age)-int(functional_age)) + " years younger than your calendar age" if int(chron_age) >= int(functional_age) else str(int(functional_age)-int(chron_age)) + " years older than your calendar age",
        'hr': hr,
        'heart_info': mistral_output['heart_info'],
        'sdnn': sdnn,
        'sdnn_info': mistral_output['sdnn_info'],
        'rmssd': rmssd,
        'rmssd_info': mistral_output['rmssd_info'],
        'nn50': nn50,
        'nn50_info': mistral_output['nn50_info'],
        'pnn50': pnn50,
        'pnn50_info': mistral_output['pnn50_info'],
        'acne': mistral_output['acne'],
        'eye_bags': mistral_output['eye_bags']
    }

    print(response_data)
    return jsonify(response_data), 200
    
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)