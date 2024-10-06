import io
from flask import Flask, request, jsonify
import os
from mistralai import Mistral
import sys
import cv2
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
    data = request.get_json()
    image_url = data.get('image_url')
    video_url = data.get('video_url')
    chron_age = data.get('age')

    hr, sdnn, rmssd, nn50, pnn50 = process_video(video_url, "data.npz")
    hr = float(hr)
    sdnn = float(sdnn)
    rmssd = float(rmssd)
    nn50 = float(nn50)
    pnn50 = float(pnn50)
    print(hr)

    mistral = Mistral(api_key="pqmKVrIjJjkKQMhvRslPapP7QzNV2A1I")
    # mistral = Mistral(api_key="OURAYTRBvuZ4rtmVs0Wlm4eRUgMsS40M")
    # mistral = Mistral(api_key="Af76fyBsx17rFnHZQVqb8rdM9uXS3XQv")

    heart_data = "Standard Deviation of NN intervals: " + str(sdnn) + " and RMSSD: Root Mean Square of Successive Differences: " + str(rmssd) + " and NN50: Number of successive differences greater than 50ms: " + str(nn50) + " and pNN50: Percentage of NN50: " + str(pnn50)

    heart_info_response = mistral.chat.complete(
        model="pixtral-12b",
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "Based on " + heart_data + ". Come up with a short blurb (1 sentence max) explaining their heart health in the second person (talk to them)." 
                    },
                ]
            }
        ]
    )
    heart_info = heart_info_response.choices[0].message.content if heart_info_response.choices else "Failed to get heart info"

    sdnn_info_response = mistral.chat.complete(
        model="pixtral-12b",
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "Based on " + str(sdnn) + ". Come up with a short blurb (1 sentence max) explaining their Standard Deviation of NN intervals in the second person (talk to them). Speak in context not just what SDNN means but what their score indicates"                    },
                ]
            }
        ]
    )
    sdnn_info = sdnn_info_response.choices[0].message.content if sdnn_info_response.choices else "Failed to get heart info"


    rmssd_info_response = mistral.chat.complete(
        model="pixtral-12b",
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "Based on " + str(rmssd) + ". Come up with a short blurb (1 sentence max) explaining their Root Mean Square of Successive Differences in the second person (talk to them). Speak in context not just what SDNN means but what their score indicates"                    },
                ]
            }
        ]
    )
    rmssd_info = rmssd_info_response.choices[0].message.content if rmssd_info_response.choices else "Failed to get heart info"

    nn50_info_response = mistral.chat.complete(
        model="pixtral-12b",
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "Based on " + str(nn50) + ". Come up with a short blurb (1 sentence max) explaining their The number of adjacent NN (normal-to-normal) intervals that differ by more than 50 milliseconds in the second person (talk to them). Speak in context not just what SDNN means but what their score indicates"                    },
                ]
            }
        ]
    )
    nn50_info = nn50_info_response.choices[0].message.content if nn50_info_response.choices else "Failed to get heart info"

    pnn50_info_response = mistral.chat.complete(
        model="pixtral-12b",
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "Based on " + str(nn50) + ". Come up with a short blurb (1 sentence max) explaining their The percentage of NN intervals that differ by more than 50 milliseconds in the second person (talk to them). Speak in context not just what SDNN means but what their score indicates"                    },
                ]
            }
        ]
    )
    pnn50_info = pnn50_info_response.choices[0].message.content if pnn50_info_response.choices else "Failed to get heart info"

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
                        "text": """Examine the person in this image closely and provide the following information:

1. Age: Estimate the person's age as a single number. No range and no other explanation.

2. Acne: Look for any signs of acne. Note its presence, severity, and location (e.g., forehead, cheeks, chin). Score on a scale of 1-10 (1 = severe acne, 10 = no acne).

3. Eye bags: Analyze the presence and severity of eye bags and droopy eyes for poor sleep. Score on a scale of 1-10 (1 = very poor sleep, 10 = very good sleep).

Provide your analysis in the following format:
Age: [number]
Acne: [score] - [brief description]
Eye bags: [score] - [brief description]"""
                    },
                    {
                        "type": "image_url",
                        "image_url": image_url
                    }
                ]
            }
        ]
    )

    analysis = response.choices[0].message.content

    parsed_analysis = {}
    for line in analysis.split('\n'):
        if ':' in line:
            key, value = line.split(':', 1)
            parsed_analysis[key.strip().lower()] = value.strip()

    # Extract values
    age = parsed_analysis.get('age', 'N/A')
    acne_score, acne_desc = parsed_analysis.get('acne', 'N/A - N/A').split(' - ', 1)
    eye_bags_score, eye_bags_desc = parsed_analysis.get('eye bags', 'N/A - N/A').split(' - ', 1)

    # pace_differential = mistral.chat.complete(
    #     model="pixtral-12b",
    #     messages=[
    #         {
    #             "role": "user",
    #             "content": [
    #                 {
    #                     "type": "text",
    #                     "text": "Use the users calendar age: " + str(chron_age) + ". And their functional age: " + str(age) + " to get their age differential in the format your biological age is AGE_DIFFERENTIAL than your calendar age. return AGE_DIFFERENTIAL only. it should be in years and months + either younger or older depending on which is higher. Return the AGE_DIFFERENTIAL value string only. No other labels or headers."
    #                 }
    #             ]
    #         }
    #     ]
    # )

    print(age, chron_age)
    pace_of_aging = (float(age)/float(chron_age))
    # age_differential = str((pace_differential.choices[0].message.content))
    age_differential = str(chron_age-age) + " years " + " younger" if int(chron_age) > int(age) else str(age-chron_age) + " years " + " older" if int(chron_age) < int(age) else " 0 years younger"
    print(age_differential)

    return jsonify({
        'functional_age': age,
        'pace_of_aging': pace_of_aging,
        'age_differential': age_differential,
        'hr': hr,
        'heart_info': heart_info,
        'sdnn': sdnn,
        'sdnn_info': sdnn_info,
        'rmssd': rmssd,
        'rmssd_info': rmssd_info,
        'nn50': nn50,
        'nn50_info': nn50_info,
        'pnn50': pnn50,
        'pnn50_info': pnn50_info,
        'acne': {
            'score': acne_score,
            'description': acne_desc
        },
        'eye_bags': {
            'score': eye_bags_score,
            'description': eye_bags_desc
        }
    }), 200
    
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port)