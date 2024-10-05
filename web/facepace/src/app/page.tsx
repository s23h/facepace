'use client';

import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/utils/supabase';
import Image from 'next/image';
import { Instrument_Serif } from 'next/font/google';
import { useRouter } from 'next/navigation';

const instrumentSerif = Instrument_Serif({ subsets: ['latin'], weight: '400' });

export default function Home() {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [loadingStep, setLoadingStep] = useState<string | null>(null);
  const [step, setStep] = useState<'start' | 'record' | 'photo' | 'age' | 'analysis'>('start');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const router = useRouter();
  const [age, setAge] = useState<string>('');
  const [recordingStep, setRecordingStep] = useState<'initial' | 'getReady' | 'faceGuide' | 'openEyes' | 'counting' | 'done'>('initial');
  const [count, setCount] = useState(1);

  useEffect(() => {
    startCamera();
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    document.body.classList.add('full-viewport-height');
    return () => {
      document.body.classList.remove('full-viewport-height');
    };
  }, []);

  useEffect(() => {
    const setVh = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    setVh();
    window.addEventListener('resize', setVh);

    return () => window.removeEventListener('resize', setVh);
  }, []);

  const startCamera = async () => {
    try {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: true
      });
      setStream(newStream);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
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
      const ctx = canvas.getContext('2d');
      if (ctx) {
        // Flip the image horizontally when capturing
        ctx.scale(-1, 1);
        ctx.drawImage(videoRef.current, -canvas.width, 0, canvas.width, canvas.height);
      }
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedImage(imageDataUrl);
    }
  };

  const uploadVideo = async (blob: Blob) => {
    try {
      const { data, error } = await supabase.storage
        .from('photos')
        .upload(`video-${Date.now()}.mp4`, blob);

      if (error) throw error;
      if (!data || !data.path) throw new Error('Video upload successful but no data returned');

      const { data: urlData } = supabase.storage.from('photos').getPublicUrl(data.path);
      if (!urlData || !urlData.publicUrl) throw new Error('Failed to get video public URL');

      setVideoUrl(urlData.publicUrl);
    } catch (error) {
      console.error('Error uploading video:', error);
    }
  };

  const startRecording = () => {
    if (!stream) return;

    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;
    const chunks: BlobPart[] = [];

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' });
      uploadVideo(blob);
      setStep('photo');
    };

    mediaRecorder.start();
    setIsRecording(true);
    setRecordingStep('getReady');

    // Sequence of steps
    setTimeout(() => setRecordingStep('faceGuide'), 2000);
    setTimeout(() => setRecordingStep('openEyes'), 4000);
    setTimeout(() => setRecordingStep('counting'), 6000);
    setTimeout(() => {
      const countInterval = setInterval(() => {
        setCount((prevCount) => {
          if (prevCount >= 5) {
            clearInterval(countInterval);
            mediaRecorder.stop();
            setIsRecording(false);
            setRecordingStep('done');
            return 5;
          }
          return prevCount + 1;
        });
      }, 1000);
    }, 6000);
  };

  const handleAgeSubmit = () => {
    if (!age || isNaN(Number(age)) || Number(age) <= 0 || Number(age) >= 120) {
      alert('Please enter a valid age between 1 and 120.');
      return;
    }
    handleUpload();
  };

  const handleUpload = async () => {
    if (!capturedImage || !videoUrl || !age) {
      console.error('Image, video URL, and age are all required');
      return;
    }

    try {
      setLoadingStep('Uploading');

      // Upload image
      const response = await fetch(capturedImage);
      const blob = await response.blob();
      const { data: imageData, error: imageError } = await supabase.storage
        .from('photos')
        .upload(`photo-${Date.now()}.jpg`, blob);

      if (imageError) throw imageError;
      if (!imageData || !imageData.path) throw new Error('Image upload successful but no data returned');

      const { data: imageUrlData } = supabase.storage.from('photos').getPublicUrl(imageData.path);
      if (!imageUrlData || !imageUrlData.publicUrl) throw new Error('Failed to get image public URL');

      const imageUrl = imageUrlData.publicUrl;

      setLoadingStep('Analyzing');

      // Instead of calling the analyze API here, we'll pass the necessary data to the results page
      router.push(`/results?videoUrl=${encodeURIComponent(videoUrl)}&imageUrl=${encodeURIComponent(imageUrl)}&age=${age}`);
    } catch (error) {
      console.error('Error in handleUpload:', error);
    } finally {
      setLoadingStep(null);
    }
  };

  const resetCapture = () => {
    setCapturedImage(null);
    startCamera();
  };

  return (
    <main className="relative w-full h-screen flex flex-col justify-between overflow-hidden">
      <div className="absolute inset-0 sm:p-4"> {/* Added sm: to make padding apply only on larger screens */}
        <div className="relative w-full h-full overflow-hidden rounded-camera"> {/* Kept rounded-camera class */}
          <video 
            ref={videoRef} 
            autoPlay 
            playsInline 
            muted 
            className={`absolute inset-0 object-cover w-full h-full transform scale-x-[-1] ${step !== 'record' || loadingStep ? 'brightness-50 blur-sm' : ''}`}
          />
        </div>
      </div>

      {capturedImage && step === 'photo' && !loadingStep && (
        <div className="absolute inset-0 sm:p-4"> {/* Added sm: to make padding apply only on larger screens */}
          <div className="relative w-full h-full overflow-hidden rounded-camera"> {/* Kept rounded-camera class */}
            <Image 
              src={capturedImage} 
              alt="Captured" 
              layout="fill"
              objectFit="cover"
              className="transform scale-x-[-1]"
            />
          </div>
        </div>
      )}

      <div className="relative z-10 flex flex-col justify-between h-full p-4 pt-safe pb-safe">
        <div className="flex-shrink-0">
          {step !== 'start' && (
            <h1 className={`${instrumentSerif.className} text-4xl font-bold text-teal-500 text-center mb-4 pt-8`}>
              Face Pace
            </h1>
          )}
        </div>

        <div className="flex-grow flex items-center justify-center">
          {step === 'start' && (
            <div className="text-center">
              <h1 className={`${instrumentSerif.className} text-6xl sm:text-8xl font-bold text-teal-500 leading-tight mb-4`}>
                Face<span className="block -mt-4">Pace</span>
              </h1>
              <p className={`${instrumentSerif.className} text-white text-2xl mb-8`}>
                Decode your Aging, <br/> Hack Longevity.
              </p>
            </div>
          )}
          {step === 'record' && (
            <div className="text-center">
              {recordingStep === 'initial' && (
                <p className={`${instrumentSerif.className} text-white text-3xl mb-4`}>
                  Center yourself in the screen<br />open your eyes wide
                </p>
              )}
              {recordingStep === 'getReady' && (
                <p className={`${instrumentSerif.className} text-white text-5xl mb-4`}>
                  Get ready
                </p>
              )}
              {recordingStep === 'faceGuide' && (
                <div className="w-64 h-80 border-4 border-white rounded-full mx-auto"></div>
              )}
              {recordingStep === 'openEyes' && (
                <p className={`${instrumentSerif.className} text-white text-5xl mb-4`}>
                  Open your eyes wide
                </p>
              )}
              {recordingStep === 'counting' && (
                <p className={`${instrumentSerif.className} text-white text-7xl mb-4`}>
                  {count}
                </p>
              )}
            </div>
          )}
          {step === 'photo' && !loadingStep && (
            <div className="flex-grow flex items-center justify-center">
              <div className="text-center">
                <p className={`${instrumentSerif.className} text-white text-3xl mb-4`}>
                  Now take a photo of<br />yourself smiling
                </p>
              </div>
            </div>
          )}
          {step === 'age' && !loadingStep && (
            <div className="text-center w-full max-w-sm mx-auto">
              <p className={`${instrumentSerif.className} text-white text-4xl mb-8`}>
                Last step:<br />Enter your age
              </p>
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className={`${instrumentSerif.className} w-full text-center text-6xl text-teal-500 bg-transparent border-b-2 border-teal-500 focus:outline-none focus:border-teal-300`}
                placeholder="Your age"
                min="1"
                max="120"
              />
            </div>
          )}
        </div>

        <div className="w-full max-w-md mx-auto space-y-4 flex-shrink-0 mb-4">
          {step === 'start' && (
            <button 
              onClick={() => setStep('record')} 
              className={`${instrumentSerif.className} w-full px-6 py-3 bg-teal-500 text-gray-900 rounded-md text-xl font-semibold shadow-lg hover:bg-teal-300 transition duration-300 ease-in-out`}
            >
              Get Started
            </button>
          )}

          {step === 'record' && (
            <>
              {!isRecording && (
                <button 
                  onClick={startRecording} 
                  className="w-20 h-20 rounded-full bg-red-500 flex items-center justify-center mx-auto transition duration-300 ease-in-out hover:bg-red-600"
                >
                  Record
                </button>
              )}
            </>
          )}

          {step === 'photo' && !loadingStep && (
            <>
              {!capturedImage ? (
                <button 
                  onClick={capturePhoto} 
                  className="w-20 h-20 rounded-full bg-white flex items-center justify-center mx-auto"
                >
                  <div className="w-16 h-16 rounded-full bg-gray-200"></div>
                </button>
              ) : (
                <div className="flex space-x-2">
                  <button 
                    onClick={resetCapture} 
                    className={`${instrumentSerif.className} flex-1 px-6 py-3 bg-red-500 text-gray-900 rounded-md text-lg font-semibold shadow-lg hover:bg-red-400 transition duration-300 ease-in-out`}
                  >
                    Retake Photo
                  </button>
                  <button 
                    onClick={() => setStep('age')} 
                    className={`${instrumentSerif.className} flex-1 px-6 py-3 bg-teal-500 text-gray-900 rounded-md text-lg font-semibold shadow-lg hover:bg-teal-300 transition duration-300 ease-in-out`}
                  >
                    Continue
                  </button>
                </div>
              )}
            </>
          )}

          {step === 'age' && !loadingStep && (
            <button 
              onClick={handleAgeSubmit}
              className={`${instrumentSerif.className} w-full px-6 py-3 bg-teal-500 text-gray-900 rounded-md text-xl font-semibold shadow-lg hover:bg-teal-300 transition duration-300 ease-in-out`}
            >
              Start Analysis
            </button>
          )}
          
          {loadingStep && (
            <div className="text-white text-center">
              <p className="text-lg mb-2">{loadingStep}...</p>
              <div className="w-8 h-8 border-t-2 border-blue-500 border-solid rounded-full animate-spin mx-auto"></div>
            </div>
          )}
        
        </div>
      </div>
    </main>
  );
}