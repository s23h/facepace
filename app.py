import io
from flask import Flask, request, jsonify
import os
from mistralai import Mistral
import sys
import cv2
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

def process_video(video_url, output_path):
    # Initialize components
    roi_detector = FaceMeshDetector()
    processor = LiCvprProcessor()
    rppg = RPPG(roi_detector)
    rppg.add_processor(processor)
    # Download video content and save to a temporary file
    with tempfile.NamedTemporaryFile(delete=False, suffix='.mp4') as temp_file:
        response = requests.get(video_url, stream=True, verify=False)
        if response.status_code != 200:
            print(f"Error: Failed to download video. Status code: {response.status_code}")
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
    
    hr = hr_calc.hr_fun(filtered_vs, ts)

    # Save results
    print(f"Processed {total_frames} frames")
    print(f"Estimated heart rate: {hr:.2f} bpm")
    cap.release()
    return hr, vs, ts

app = Flask(__name__)

@app.route('/')
def index():
    return "Hello world"

@app.route('/pixtral_get_age', methods=['POST'])
def pixtral_get_age():
    data = request.get_json()
    image_url = data.get('image_url')
    video_url = data.get('video_url')

    hr, vs, ts = process_video(video_url, "data.npz")

    hrv_prompt = f"""
    Given the following data from a video-based heart rate measurement:
    - Calculated heart rate: {hr} bpm
    - Pulse wave signal (vs): {vs[:10]}... (truncated for brevity)
    - Time vector (ts): {ts[:10]}... (truncated for brevity)

    Please analyze this data and provide:
    1. The estimated heart rate (in bpm)
    2. The estimated heart rate variability (in ms)

    Output your response as two numbers separated by a comma, like this: 'heart_rate, heart_rate_variability'
    """

    mistral = Mistral(api_key="OURAYTRBvuZ4rtmVs0Wlm4eRUgMsS40M")

    # Request analysis from Mistral
    hrv_response = mistral.chat.complete(
        model="mistral-large",
        messages=[
            {
                "role": "user",
                "content": hrv_prompt
            }
        ]
    )

    if hrv_response.choices:
        hr_analysis = hrv_response.choices[0].message.content.strip()
        hr_estimate, hrv_estimate = map(float, hr_analysis.split(','))
    else:
        hr_estimate, hrv_estimate = hr, None  # Use calculated hr if Mistral fails

    if not image_url:
        return jsonify({'error': 'Image URL is required'}), 400

    response = mistral.chat.complete(
        model="pixtral-12b",
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "What is the age of this person? Output a singular number."
                    },
                    {
                        "type": "image_url",
                        "image_url": image_url
                    }
                ]
            }
        ]
    )

    if response.choices:
        age = response.choices[0].message.content
        return jsonify({'age': age, 'hr': hr, "hrv_estimate": hrv_estimate, "hr_estimate": hr_estimate}), 200
    else:
        return jsonify({'error': 'Failed to determine age'}), 500
    
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)