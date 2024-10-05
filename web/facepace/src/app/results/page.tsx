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
  const [showResults, setShowResults] = useState(true);
  const [hasEnteredName, setHasEnteredName] = useState(false);
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
    if (!userName || !functionalAge || !imageUrl) return;

    try {
      const { error } = await supabase
        .from('leaderboard')
        .insert([
          { name: userName, functional_age: functionalAge, image_url: imageUrl }
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

  return (
    <main className="relative w-full h-screen flex flex-col justify-between overflow-hidden bg-black">
      <div className="flex-grow flex flex-col justify-between h-full p-4 pt-safe pb-safe">
        {showResults && (
          /* Swipeable Results Cards */
          <div className="flex-grow flex items-center overflow-hidden mb-4">
            <div className="relative w-full max-w-md mx-auto h-full flex items-center">
              <div 
                ref={cardsContainerRef} 
                className="overflow-x-auto snap-x snap-mandatory flex w-full h-full scrollbar-hide"
              >
                {/* Functional Age Card */}
                <div className="snap-center shrink-0 w-full flex-none h-full flex items-center">
                  <div className="bg-black rounded-lg shadow-lg p-6 m-2 w-full border-teal-50 border-2">
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
                <div className="snap-center shrink-0 w-full flex-none h-full flex items-center">
                  <div className="bg-black rounded-lg shadow-lg p-6 m-2 w-full border-teal-50 border-2">
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
            <h2 className={`${instrumentSerif.className} text-2xl font-semibold mb-4 text-white text-center pt-4`}>Leaderboard</h2>
            <div className="space-y-4">
                            {userRank && userRank > 10 && (
              <div className="mt-4 p-2 bg-teal-500 rounded">
                <p className="text-white">Your rank: {userRank}</p>
              </div>
            )}
              {leaderboardData.slice(0, 10).map((entry, index) => (
                <div key={entry.id} className={`flex items-center p-2 ${entry.name === userName ? 'bg-teal-500 rounded' : ''}`}>
                  <span className="font-bold mr-4 text-white">{index + 1}</span>
                  <div className="w-10 h-10 rounded-camera overflow-hidden mr-4">
                    <Image
                      src={entry.image_url || '/default-avatar.png'}
                      alt={entry.name}
                      width={40}
                      height={40}
                      className="object-cover w-full h-full"
                    />
                  </div>
                  <span className="flex-grow text-white">{entry.name}</span>
                  <span className="font-semibold text-white">{entry.functional_age}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Actions Card */}
        <div className="w-full max-w-md mx-auto">
          <div className="bg-black rounded-lg shadow-lg py-4">
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