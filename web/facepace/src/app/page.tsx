'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import axios from 'axios';
import Image from 'next/image';

export default function Home() {
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isCameraReady, setIsCameraReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [loadingStep, setLoadingStep] = useState<string | null>(null);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      const constraints = {
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setIsCameraReady(true);
        };
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
    }
  };

  const capturePhoto = () => {
    if (videoRef.current) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedImage(imageDataUrl);
    }
  };

  const handleUpload = async () => {
    if (!capturedImage) {
      console.error('No image captured');
      return;
    }

    try {
      setLoadingStep('Uploading');
      await new Promise(resolve => setTimeout(resolve, 1000)); // Ensure at least 1 second display

      const response = await fetch(capturedImage);
      const blob = await response.blob();

      const { data, error } = await supabase.storage
        .from('photos')
        .upload(`photo-${Date.now()}.jpg`, blob);

      if (error) {
        console.error('Error uploading file:', error);
        setLoadingStep(null);
        return;
      }

      if (!data || !data.path) {
        console.error('Upload successful but no data returned');
        setLoadingStep(null);
        return;
      }

      const { data: urlData } = supabase.storage
        .from('photos')
        .getPublicUrl(data.path);

      if (!urlData || !urlData.publicUrl) {
        console.error('Failed to get public URL');
        setLoadingStep(null);
        return;
      }

      setLoadingStep('Analyzing');
      await new Promise(resolve => setTimeout(resolve, 1000)); // Ensure at least 1 second display

      const analyzeResponse = await axios.post('/api/analyze', { imageUrl: urlData.publicUrl });
      
      if (!analyzeResponse.data || !analyzeResponse.data.result) {
        console.error('Analyze API returned unexpected data:', analyzeResponse.data);
        setLoadingStep(null);
        return;
      }

      setAnalysisResult(analyzeResponse.data.result);
    } catch (error) {
      console.error('Error in handleUpload:', error);
    } finally {
      setLoadingStep(null);
    }
  };

  const resetCapture = () => {
    setCapturedImage(null);
    setAnalysisResult(null);
    startCamera();
  };

  return (
    <main className="relative h-screen w-full overflow-hidden">
      {!capturedImage ? (
        <div className="absolute inset-0">
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className="object-cover w-full h-full"
          />
        </div>
      ) : (
        <div className="absolute inset-0">
          <Image 
            src={capturedImage} 
            alt="Captured" 
            layout="fill"
            objectFit="cover"
          />
        </div>
      )}

      <div className="absolute inset-0 bg-black bg-opacity-50 flex flex-col items-center justify-between p-4">
        <h1 className="text-3xl sm:text-4xl font-bold text-white text-center mt-8">Face Analyzer</h1>
        
        <div className="w-full max-w-md space-y-4">
          {!capturedImage ? (
            <>
              {!isCameraReady && (
                <button 
                  onClick={startCamera} 
                  className="w-full px-6 py-3 bg-blue-500 text-white rounded-full text-lg font-semibold shadow-lg hover:bg-blue-600 transition duration-300 ease-in-out"
                >
                  Start Camera
                </button>
              )}
              {isCameraReady && (
                <button 
                  onClick={capturePhoto} 
                  className="w-full px-6 py-3 bg-green-500 text-white rounded-full text-lg font-semibold shadow-lg hover:bg-green-600 transition duration-300 ease-in-out"
                >
                  Capture Photo
                </button>
              )}
            </>
          ) : (
            <div className="flex space-x-2">
              <button 
                onClick={handleUpload} 
                disabled={!!loadingStep}
                className={`flex-1 px-6 py-3 bg-blue-500 text-white rounded-full text-lg font-semibold shadow-lg transition duration-300 ease-in-out ${
                  loadingStep ? 'opacity-75 cursor-not-allowed' : 'hover:bg-blue-600'
                }`}
              >
                {loadingStep ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {loadingStep}...
                  </span>
                ) : (
                  'Analyze'
                )}
              </button>
              <button 
                onClick={resetCapture} 
                disabled={!!loadingStep}
                className={`flex-1 px-6 py-3 bg-red-500 text-white rounded-full text-lg font-semibold shadow-lg transition duration-300 ease-in-out ${
                  loadingStep ? 'opacity-75 cursor-not-allowed' : 'hover:bg-red-600'
                }`}
              >
                Retake
              </button>
            </div>
          )}
          
          {analysisResult && !loadingStep && (
            <div className="p-4 bg-white bg-opacity-80 rounded-lg">
              <h2 className="text-xl font-semibold mb-2">Analysis Result:</h2>
              <p className="text-lg">{analysisResult}</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}