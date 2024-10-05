'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import Image from 'next/image';
import { Instrument_Serif } from 'next/font/google';
import axios from 'axios';

const instrumentSerif = Instrument_Serif({ subsets: ['latin'], weight: '400' });

interface LeaderboardEntry {
  id: string;
  name: string;
  functional_age: number;
  image_url: string;
  created_at: string;
}

interface AgingStatus {
  value: number;
  label: string;
  scale: {
    label: string;
    color: string;
    range: [number, number];
  }[];
}

const AGING_STATUS: AgingStatus = {
  value: 25, // This value should be between 0 and 100
  label: "Reduced",
  scale: [
    {
      label: "Reduced",
      color: "#34D399",
      range: [0, 33]
    },
    {
      label: "Average",
      color: "#9CA3AF",
      range: [34, 66]
    },
    {
      label: "Accelerated",
      color: "#EF4444",
      range: [67, 100]
    }
  ]
};

interface AnalysisResult {
  acne: { description: string; score: string };
  age_differential: string;
  eye_bags: { description: string; score: string };
  functional_age: string;
  heart_info: string;
  hr: number;
  nn50: number;
  nn50_info: string;
  pace_of_aging: number;
  pnn50: number;
  pnn50_info: string;
  rmssd: number;
  rmssd_info: string;
  sdnn: number;
  sdnn_info: string;
}

function ResultsContent() {
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [showNameInput, setShowNameInput] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [showResults, setShowResults] = useState(true);
  const [hasEnteredName, setHasEnteredName] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const searchParams = useSearchParams();
  const cardsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchAnalysis = async () => {
      const videoUrl = searchParams?.get('videoUrl');
      const imageUrl = searchParams?.get('imageUrl');
      const age = searchParams?.get('age');

      if (videoUrl && imageUrl && age) {
        setImageUrl(decodeURIComponent(imageUrl));
        try {
          const response = await axios.post('/api/analyze', {
            videoUrl: decodeURIComponent(videoUrl),
            imageUrl: decodeURIComponent(imageUrl),
            age: Number(age)
          });
          setAnalysisResult(response.data.result);
        } catch (error) {
          console.error('Error fetching analysis:', error);
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchAnalysis();
  }, [searchParams]);

  useEffect(() => {
    // Change the status bar color when the component mounts
    const metaThemeColor = document.querySelector('meta[name="theme-color"]');
    if (metaThemeColor) {
      metaThemeColor.setAttribute('content', '#FEF9EF');
    }

    // Revert the status bar color when the component unmounts
    return () => {
      if (metaThemeColor) {
        metaThemeColor.setAttribute('content', '#000000');
      }
    };
  }, []);

  const handleSeeRank = () => {
    if (hasEnteredName) {
      fetchLeaderboard();
      setShowLeaderboard(true);
      setShowResults(false);
    } else {
      setShowNameInput(true);
    }
  };

  const handleAddToLeaderboard = async () => {
    if (!userName || !analysisResult || !imageUrl) return;

    try {
      const { error } = await supabase
        .from('leaderboard')
        .insert([
          { name: userName, functional_age: Number(analysisResult.functional_age), image_url: imageUrl }
        ]);

      if (error) throw error;

      setHasEnteredName(true);
      await fetchLeaderboard();
      setShowLeaderboard(true);
      setShowResults(false);
      setShowNameInput(false);
    } catch (error) {
      console.error('Error adding to leaderboard:', error);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const { data, error } = await supabase
        .from('leaderboard')
        .select('*')
        .order('functional_age', { ascending: true });

      if (error) throw error;

      setLeaderboardData(data || []);

      // Find user's rank
      const userIndex = data?.findIndex(entry => entry.name === userName);
      if (userIndex !== -1) setUserRank(userIndex + 1);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    }
  };

  const handleScroll = (direction: 'left' | 'right') => {
    if (cardsContainerRef.current) {
      const scrollAmount = direction === 'left' ? -cardsContainerRef.current.offsetWidth : cardsContainerRef.current.offsetWidth;
      cardsContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const toggleView = () => {
    setShowResults(!showResults);
    setShowLeaderboard(!showLeaderboard);
  };

  const renderScalingBar = () => {
    return (
      <div className="mt-10">
        <div className="flex justify-between mb-2">
          {AGING_STATUS.scale.map((item) => (
            <span key={item.label} className="text-sm text-gray-500">{item.label}</span>
          ))}
        </div>
        <div className="h-2 flex">
          {AGING_STATUS.scale.map((item) => (
            <div
              key={item.label}
              className="flex-1"
              style={{ backgroundColor: item.color }}
            />
          ))}
        </div>
        <div className="relative h-4">
          <div
            className="absolute w-0 h-0 border-solid border-x-8 border-x-transparent border-b-[16px]"
            style={{
              borderBottomColor: 'black',
              left: `${AGING_STATUS.value}%`,
              transform: 'translateX(-50%)'
            }}
          />
        </div>
        <p className="text-center mt-2 text-gray-500">Your aging: <span className="font-bold">{AGING_STATUS.label}</span></p>
      </div>
    );
  };

  const renderAnalysisCards = () => {
    if (!analysisResult) return null;

    return (
      <>
        {/* Functional Age Card */}
        <div className="snap-center shrink-0 w-full flex-none h-full flex items-center">
          <div className="bg-custom-bg rounded-lg shadow-lg p-6 m-2 w-full border-teal-500 border-2">
            <div className={`${instrumentSerif.className}`}>
              <p className="text-3xl mb-2 text-gray-900">Your Functional Age</p>
              <p className="text-8xl font-bold text-teal-500 my-4">{analysisResult.functional_age}</p>
              <p className="text-3xl text-gray-900">
                This means your biological age is 
                <span className="text-teal-500"> {analysisResult.age_differential} </span>
                than your calendar age.
              </p>
              {renderScalingBar()}
            </div>
          </div>
        </div>

        {/* Heart Health Card */}
        <div className="snap-center shrink-0 w-full flex-none h-full flex items-center">
          <div className="bg-custom-bg rounded-lg shadow-lg p-6 m-2 w-full border-teal-500 border-2">
            <div className={`${instrumentSerif.className}`}>
              <h2 className="text-3xl mb-4 text-gray-900">Your Heart Health</h2>
              <div className="flex items-baseline mb-4">
                <span className="text-8xl font-bold text-teal-500">{analysisResult.hr.toFixed(0)}</span>
                <span className="text-4xl ml-2 text-teal-500">bpm</span>
              </div>
              <p className="text-lg mb-6 text-gray-900">{analysisResult.heart_info}</p>
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-3xl text-teal-500">{analysisResult.nn50.toFixed(1)}</p>
                  <p className="text-sm text-gray-500">nn50</p>
                </div>
                <div>
                  <p className="text-3xl text-teal-500">{analysisResult.pnn50.toFixed(0)}%</p>
                  <p className="text-sm text-gray-500">pnn50</p>
                </div>
                <div>
                  <p className="text-3xl text-teal-500">{analysisResult.rmssd.toFixed(0)}</p>
                  <p className="text-sm text-gray-500">rmssd</p>
                </div>
                <div>
                  <p className="text-3xl text-teal-500">{analysisResult.sdnn.toFixed(0)}</p>
                  <p className="text-sm text-gray-500">sdnn</p>
                </div>
              </div>
              {renderScalingBar()}
            </div>
          </div>
        </div>

        {/* Skin Analysis Card */}
        <div className="snap-center shrink-0 w-full flex-none h-full flex items-center">
          <div className="bg-custom-bg rounded-lg shadow-lg p-6 m-2 w-full border-teal-500 border-2">
            <div className={`${instrumentSerif.className}`}>
              <p className="text-3xl mb-2 text-gray-900 ">Your Skin Analysis</p>
              <div className="space-y-4">
                <div>
                  <p className="text-xl text-gray-900">Acne</p>
                  <p className="text-md text-gray-500">{analysisResult.acne.description}</p>
                  <p className="text-teal-500">Score: {analysisResult.acne.score}/10</p>
                </div>
                <div>
                  <p className="text-xl text-gray-900">Eye Bags</p>
                  <p className="text-md text-gray-500">{analysisResult.eye_bags.description}</p>
                  <p className="text-teal-500">Score: {analysisResult.eye_bags.score}/10</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  };

  return (
    <main className="relative w-full h-screen flex flex-col justify-between overflow-hidden bg-custom-bg">
      <div className="flex-grow flex flex-col justify-between h-full p-4 pt-safe pb-safe">
        {isLoading ? (
          <div className="flex-grow flex items-center justify-center">
            <p className="text-2xl">Loading analysis results...</p>
          </div>
        ) : showResults && (
          <div className="flex-grow flex items-center overflow-hidden mb-4">
            <div className="relative w-full max-w-md mx-auto h-full flex items-center">
              <div 
                ref={cardsContainerRef} 
                className="overflow-x-auto snap-x snap-mandatory flex w-full h-full scrollbar-hide"
              >
                {renderAnalysisCards()}
              </div>
              <button 
                onClick={() => handleScroll('left')} 
                className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-teal-500 rounded-full p-2 shadow-md z-10"
              >
                &lt;
              </button>
              <button 
                onClick={() => handleScroll('right')} 
                className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-teal-500 rounded-full p-2 shadow-md z-10"
              >
                &gt;
              </button>
            </div>
          </div>
        )}

        {showLeaderboard && (
          <div className="flex-grow overflow-y-auto mb-4 w-full max-w-md mx-auto">
            <h2 className={`${instrumentSerif.className} text-2xl font-semibold mb-4 text-teal-500 text-center pt-4`}>Leaderboard</h2>
            <div className="space-y-4">
                            {userRank && userRank > 10 && (
              <div className="mt-4 p-2 bg-teal-500 rounded">
                <p className="text-white">Your rank: {userRank}</p>
              </div>
            )}
              {leaderboardData.slice(0, 10).map((entry, index) => (
                <div key={entry.id} className={`flex items-center p-2 ${entry.name === userName ? 'bg-teal-500 rounded' : ''}`}>
                  <span className="font-bold mr-4 text-gray-800">{index + 1}</span>
                  <div className="w-10 h-10 rounded-camera overflow-hidden mr-4">
                    <Image
                      src={entry.image_url || '/default-avatar.png'}
                      alt={entry.name}
                      width={40}
                      height={40}
                      className="object-cover w-full h-full"
                    />
                  </div>
                  <span className="flex-grow text-gray-800">{entry.name}</span>
                  <span className="font-semibold text-gray-800">{entry.functional_age}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions Card */}
        <div className="w-full max-w-md mx-auto">
          <div className="bg-custom-bg rounded-lg shadow-lg py-4">
            {!showNameInput && !showLeaderboard && (
              <div className="space-y-4">
                <button
                  onClick={handleSeeRank}
                  className="w-full bg-teal-500 text-white py-2 px-4 rounded-md hover:bg-teal-600 transition duration-300"
                >
                  {hasEnteredName ? "Show Leaderboard" : "Unlock Leaderboard"}
                </button>
              </div>
            )}

            {showNameInput && !showLeaderboard && (
              <div>
                <div className="mb-4">
                  <input
                    type="text"
                    value={userName}
                    onChange={(e) => setUserName(e.target.value)}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 text-black"
                    placeholder="To see where you rank, add your name"
                  />
                </div>
                <button
                  onClick={handleAddToLeaderboard}
                  className="w-full bg-teal-500 text-white py-2 px-4 rounded-md hover:bg-teal-600 transition duration-300"
                  disabled={!userName.trim()}
                >
                  LEADERBOARD!
                </button>
              </div>
            )}

            {showLeaderboard && (
              <button
                onClick={toggleView}
                className="w-full bg-teal-500 text-white py-2 px-4 rounded-md hover:bg-teal-600 transition duration-300"
              >
                Show Results
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResultsContent />
    </Suspense>
  );
}