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

  useEffect(() => {
    startCamera();
  }, []);

  const startCamera = async () => {
    try {
      const constraints = {
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
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
      const response = await fetch(capturedImage);
      const blob = await response.blob();

      const { data, error } = await supabase.storage
        .from('photos')
        .upload(`photo-${Date.now()}.jpg`, blob);

      if (error) {
        console.error('Error uploading file:', error);
        return;
      }

      if (!data || !data.path) {
        console.error('Upload successful but no data returned');
        return;
      }

      const { data: urlData } = supabase.storage
        .from('photos')
        .getPublicUrl(data.path);

      if (!urlData || !urlData.publicUrl) {
        console.error('Failed to get public URL');
        return;
      }

      const analyzeResponse = await axios.post('/api/analyze', { imageUrl: urlData.publicUrl });
      
      if (!analyzeResponse.data || !analyzeResponse.data.result) {
        console.error('Analyze API returned unexpected data:', analyzeResponse.data);
        return;
      }

      setAnalysisResult(analyzeResponse.data.result);
    } catch (error) {
      console.error('Error in handleUpload:', error);
    }
  };

  const resetCapture = () => {
    setCapturedImage(null);
    setAnalysisResult(null);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8">
      <h1 className="text-3xl sm:text-4xl font-bold mb-6 text-center">Age Analyzer</h1>
      <div className="w-full max-w-md">
        {!capturedImage ? (
          <>
            <div className="relative w-full h-0 pb-[75%] mb-4 bg-gray-200 rounded-lg overflow-hidden">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="absolute top-0 left-0 w-full h-full object-cover"
              />
            </div>
            {!isCameraReady && (
              <button 
                onClick={startCamera} 
                className="w-full mb-4 px-4 py-3 bg-blue-500 text-white rounded-lg text-lg"
              >
                Start Camera
              </button>
            )}
            {isCameraReady && (
              <button 
                onClick={capturePhoto} 
                className="w-full mb-4 px-4 py-3 bg-green-500 text-white rounded-lg text-lg"
              >
                Capture Photo
              </button>
            )}
          </>
        ) : (
          <>
            <div className="relative w-full h-0 pb-[75%] mb-4 bg-gray-200 rounded-lg overflow-hidden">
              <Image 
                src={capturedImage} 
                alt="Captured" 
                layout="fill"
                objectFit="cover"
              />
            </div>
            <div className="flex space-x-2">
              <button 
                onClick={handleUpload} 
                className="flex-1 px-4 py-3 bg-blue-500 text-white rounded-lg text-lg"
              >
                Upload and Analyze
              </button>
              <button 
                onClick={resetCapture} 
                className="flex-1 px-4 py-3 bg-red-500 text-white rounded-lg text-lg"
              >
                Retake
              </button>
            </div>
          </>
        )}
        {analysisResult && (
          <div className="mt-6 p-4 bg-gray-100 rounded-lg">
            <h2 className="text-xl font-semibold mb-2">Analysis Result:</h2>
            <p className="text-lg">{analysisResult}</p>
          </div>
        )}
      </div>
    </main>
  );
}