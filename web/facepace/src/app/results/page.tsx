'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import Image from 'next/image';
import { Instrument_Serif } from 'next/font/google';

const instrumentSerif = Instrument_Serif({ subsets: ['latin'], weight: '400' });

interface LeaderboardEntry {
  id: string;
  name: string;
  functional_age: number;
  image_url: string;
  created_at: string;
}

function ResultsContent() {
  const [functionalAge, setFunctionalAge] = useState<number | null>(null);
  const [biologicalAgeDifference, setBiologicalAgeDifference] = useState<string | null>(null);
  const [heartRate, setHeartRate] = useState<number | null>(null);
  const [heartRateVariability, setHeartRateVariability] = useState<number | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [showNameInput, setShowNameInput] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const searchParams = useSearchParams();
  const cardsContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const functionalAgeParam = searchParams?.get('functionalAge');
    const biologicalAgeDifferenceParam = searchParams?.get('biologicalAgeDifference');
    const heartRateParam = searchParams?.get('heartRate');
    const heartRateVariabilityParam = searchParams?.get('heartRateVariability');
    const imageUrlParam = searchParams?.get('imageUrl');

    if (functionalAgeParam) setFunctionalAge(Number(functionalAgeParam));
    if (biologicalAgeDifferenceParam) setBiologicalAgeDifference(biologicalAgeDifferenceParam);
    if (heartRateParam) setHeartRate(Number(heartRateParam));
    if (heartRateVariabilityParam) setHeartRateVariability(Number(heartRateVariabilityParam));
    if (imageUrlParam) setImageUrl(decodeURIComponent(imageUrlParam));
  }, [searchParams]);

  const handleShare = () => {
    // Implement share functionality
    console.log('Share functionality to be implemented');
  };

  const handleSeeRank = () => {
    setShowNameInput(true);
  };

  const handleAddToLeaderboard = async () => {
    if (!userName || !functionalAge || !imageUrl) return;

    try {
      const { error } = await supabase
        .from('leaderboard')
        .insert([
          { name: userName, functional_age: functionalAge, image_url: imageUrl }
        ]);

      if (error) throw error;

      await fetchLeaderboard();
      setShowLeaderboard(true);
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

  return (
    <main className="min-h-screen bg-gray-100 p-4">
      {/* Swipeable Results Cards */}
      <div className="relative max-w-md mx-auto mb-4">
        <div 
          ref={cardsContainerRef} 
          className="overflow-x-auto snap-x snap-mandatory flex w-full scrollbar-hide"
        >
          {/* Functional Age Card */}
          <div className="snap-center shrink-0 w-full flex-none">
            <div className="bg-white rounded-lg shadow-lg p-6 m-2">
              <div className={`${instrumentSerif.className}`}>
                <p className="text-2xl mb-2">Your functional age is</p>
                <p className="text-8xl font-bold text-teal-500 my-4">{functionalAge}</p>
                <p className="text-3xl">
                  This means your biological age is<br />
                  <span className="text-teal-500">{biologicalAgeDifference}</span><br />
                  than your calendar age.
                </p>
              </div>
            </div>
          </div>

          {/* Heart Rate and HRV Card */}
          <div className="snap-center shrink-0 w-full flex-none">
            <div className="bg-white rounded-lg shadow-lg p-6 m-2">
              <div className={`${instrumentSerif.className}`}>
                <p className="text-2xl mb-2">Your heart metrics</p>
                <div className="flex justify-between items-center my-4">
                  <div>
                    <p className="text-6xl font-bold text-teal-500">{heartRate}</p>
                    <p className="text-xl">BPM</p>
                  </div>
                  <div>
                    <p className="text-6xl font-bold text-teal-500">{heartRateVariability}</p>
                    <p className="text-xl">ms HRV</p>
                  </div>
                </div>
                <p className="text-3xl">
                  Your heart health is<br />
                  <span className="text-teal-500">above average</span><br />
                  for your age group.
                </p>
              </div>
            </div>
          </div>
        </div>
        <button 
          onClick={() => handleScroll('left')} 
          className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-white rounded-full p-2 shadow-md z-10"
        >
          &lt;
        </button>
        <button 
          onClick={() => handleScroll('right')} 
          className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-white rounded-full p-2 shadow-md z-10"
        >
          &gt;
        </button>
      </div>

      {/* Actions Card */}
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
        {!showNameInput && !showLeaderboard && (
          <div className="space-y-4">
            <button
              onClick={handleShare}
              className="w-full bg-teal-500 text-white py-2 px-4 rounded-md hover:bg-teal-600 transition duration-300"
            >
              SHARE NOW
            </button>
            <button
              onClick={handleSeeRank}
              className="w-full bg-white text-teal-500 border border-teal-500 py-2 px-4 rounded-md hover:bg-teal-50 transition duration-300"
            >
              See where you rank
            </button>
          </div>
        )}

        {showNameInput && !showLeaderboard && (
          <div>
            <h2 className="text-2xl font-semibold mb-4">To see where you rank, add your name</h2>
            <div className="mb-4">
              <input
                type="text"
                value={userName}
                onChange={(e) => setUserName(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                placeholder="Enter your name"
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
          <div>
            <h2 className="text-2xl font-semibold mb-4">Leaderboard</h2>
            <div className="space-y-4">
              {leaderboardData.slice(0, 10).map((entry, index) => (
                <div key={entry.id} className={`flex items-center p-2 ${index === (userRank ?? 0) - 1 ? 'bg-teal-100 rounded' : ''}`}>
                  <span className="font-bold mr-4">{index + 1}</span>
                  <Image
                    src={entry.image_url || '/default-avatar.png'}
                    alt={entry.name}
                    width={40}
                    height={40}
                    className="rounded-full mr-4"
                  />
                  <span className="flex-grow">{entry.name}</span>
                  <span className="font-semibold">{entry.functional_age}</span>
                </div>
              ))}
            </div>
            {userRank && userRank > 10 && (
              <div className="mt-4 p-2 bg-teal-100 rounded">
                <p>Your rank: {userRank}</p>
              </div>
            )}
          </div>
        )}
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