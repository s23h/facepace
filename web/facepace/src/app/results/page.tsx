'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/utils/supabase';
import Image from 'next/image';
import { Instrument_Serif } from 'next/font/google';
import axios from 'axios';
import { Drawer } from 'vaul';

// Add this import for the question mark icon
import { FaQuestionCircle } from 'react-icons/fa';

const instrumentSerif = Instrument_Serif({ subsets: ['latin'], weight: '400' });

interface LeaderboardEntry {
  id: string;
  name: string;
  image_url: string;
  created_at: string;
  pace_of_aging: number;
}

interface AgingStatus {
  label: string;
  scale: {
    label: string;
    color: string;
    range: [number, number];
  }[];
}

const AGING_STATUS: AgingStatus = {
  label: "Reduced",
  scale: [
    {
      label: "Reduced",
      color: "#34D399",
      range: [0.5, 0.9]
    },
    {
      label: "Average",
      color: "#9CA3AF",
      range: [0.9, 1.1]
    },
    {
      label: "Accelerated",
      color: "#EF4444",
      range: [1.1, 1.5]
    }
  ]
};

// Add this new interface for heart health status
interface HeartHealthStatus {
  label: string;
  scale: {
    label: string;
    color: string;
    range: [number, number];
  }[];
}

// Add this new constant for heart health status
const HEART_HEALTH_STATUS: HeartHealthStatus = {
  label: "Heart Rate",
  scale: [
    {
      label: "Low",
      color: "#3B82F6", // Blue
      range: [40, 60]
    },
    {
      label: "Normal",
      color: "#34D399", // Green
      range: [60, 100]
    },
    {
      label: "Elevated",
      color: "#FBBF24", // Yellow
      range: [100, 120]
    },
    {
      label: "High",
      color: "#EF4444", // Red
      range: [120, 160]
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
  brain_health: {
    description: string;
  };
  pupil_coefficent_variation: string;
  estimated_saccades_fixations: number;
}

function ResultsContent() {
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardEntry[]>([]);
  const [userRank, setUserRank] = useState<number | null>(null);
  const [hasEnteredName, setHasEnteredName] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const cardsContainerRef = useRef<HTMLDivElement>(null);
  const [currentCardIndex, setCurrentCardIndex] = useState(0);
  const totalCards = 4;
  const [analysisStatus, setAnalysisStatus] = useState<'idle' | 'loading' | 'complete'>('idle');
  const apiCallRef = useRef(false);

  // Separate drawer states for info and metrics
  const [isInfoDrawerOpen, setIsInfoDrawerOpen] = useState(false);
  const [isMetricDrawerOpen, setIsMetricDrawerOpen] = useState(false);

  // Add this new state for the info drawer
  const [infoDrawerContent, setInfoDrawerContent] = useState<{ title: string; content: string } | null>(null);

  useEffect(() => {
    const fetchAnalysis = async () => {
      const videoUrl = searchParams?.get('videoUrl');
      const imageUrl = searchParams?.get('imageUrl');
      const age = searchParams?.get('age');

      if (videoUrl && imageUrl && age && !apiCallRef.current) {
        setImageUrl(decodeURIComponent(imageUrl));
        setAnalysisStatus('loading');
        apiCallRef.current = true;
        try {
          const response = await axios.post('/api/analyze', {
            videoUrl: decodeURIComponent(videoUrl),
            imageUrl: decodeURIComponent(imageUrl),
            age: Number(age)
          });
          setAnalysisResult(response.data.result);
          setAnalysisStatus('complete');
        } catch (error) {
          console.error('Error fetching analysis:', error);
          setAnalysisStatus('complete'); // Set to complete even on error to remove loading screen
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

  const handleAddToLeaderboard = async () => {
    if (!userName || !analysisResult || !imageUrl) return;

    try {
      const { error } = await supabase
        .from('leaderboard')
        .insert([
          { name: userName, pace_of_aging: Number(analysisResult.pace_of_aging), image_url: imageUrl }
        ]);

      if (error) throw error;

      setHasEnteredName(true);
      await fetchLeaderboard();
    } catch (error) {
      console.error('Error adding to leaderboard:', error);
    }
  };

  const fetchLeaderboard = async () => {
    try {
      const { data, error } = await supabase
        .from('leaderboard')
        .select('*')
        .order('pace_of_aging', { ascending: true });

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
      
      // Update the current card index
      setCurrentCardIndex(prevIndex => {
        if (direction === 'left' && prevIndex > 0) return prevIndex - 1;
        if (direction === 'right' && prevIndex < totalCards - 1) return prevIndex + 1;
        return prevIndex;
      });
    }
  };

  const renderScalingBar = () => {
    if (!analysisResult) return null;

    const paceOfAging = analysisResult.pace_of_aging;
    const minValue = AGING_STATUS.scale[0].range[0];
    const maxValue = AGING_STATUS.scale[AGING_STATUS.scale.length - 1].range[1];
    
    // Calculate the percentage for positioning the indicator
    const percentage = ((paceOfAging - minValue) / (maxValue - minValue)) * 100;

    return (
      <div className="mt-10">
        <div className="flex justify-between mb-2">
          {AGING_STATUS.scale.map((item) => (
            <span key={item.label} className="text-sm text-gray-500">{item.label}</span>
          ))}
        </div>
        <div className="h-2 flex relative">
          {AGING_STATUS.scale.map((item, index) => (
            <div
              key={item.label}
              className="flex-1 relative"
              style={{ backgroundColor: item.color }}
            >
              {index === 0 && (
                <span className="absolute top-4 left-0 text-xs text-gray-500 transform -translate-x-1/2">
                  {item.range[0]}
                </span>
              )}
              {index === Math.floor(AGING_STATUS.scale.length / 2) && (
                <span className="absolute top-4 left-1/2 text-xs text-gray-500 transform -translate-x-1/2">
                  1.0
                </span>
              )}
            </div>
          ))}
          <span className="absolute top-4 right-0 text-xs text-gray-500 transform translate-x-1/2">
            {maxValue}
          </span>
          <div
            className="absolute w-0 h-0 border-solid border-x-8 border-x-transparent border-t-[16px] top-full"
            style={{
              borderTopColor: 'black',
              left: `${percentage}%`,
              transform: 'translateX(-50%) rotate(180deg)'
            }}
          />
        </div>
        <p className="text-center mt-8 text-gray-500">
          Your Aging: <span className="font-bold">{paceOfAging.toFixed(2)}</span>
        </p>
      </div>
    );
  };

  const renderHeartHealthScalingBar = () => {
    if (!analysisResult) return null;

    const heartRate = analysisResult.hr;
    const minValue = HEART_HEALTH_STATUS.scale[0].range[0];
    const maxValue = HEART_HEALTH_STATUS.scale[HEART_HEALTH_STATUS.scale.length - 1].range[1];
    
    // Calculate the percentage for positioning the indicator
    const percentage = ((heartRate - minValue) / (maxValue - minValue)) * 100;

    return (
      <div className="mt-10">
        <div className="flex justify-between mb-2">
          {HEART_HEALTH_STATUS.scale.map((item) => (
            <span key={item.label} className="text-sm text-gray-500">{item.label}</span>
          ))}
        </div>
        <div className="h-2 flex relative">
          {HEART_HEALTH_STATUS.scale.map((item, index) => (
            <div
              key={item.label}
              className="flex-1 relative"
              style={{ backgroundColor: item.color }}
            >
              {index === 0 && (
                <span className="absolute top-4 left-0 text-xs text-gray-500 transform -translate-x-1/2">
                  {item.range[0]}
                </span>
              )}
              {index === HEART_HEALTH_STATUS.scale.length - 1 && (
                <span className="absolute top-4 right-0 text-xs text-gray-500 transform translate-x-1/2">
                  {item.range[1]}
                </span>
              )}
            </div>
          ))}
          <div
            className="absolute w-0 h-0 border-solid border-x-8 border-x-transparent border-t-[16px] top-full"
            style={{
              borderTopColor: 'black',
              left: `${percentage}%`,
              transform: 'translateX(-50%) rotate(180deg)'
            }}
          />
        </div>
        <p className="text-center mt-8 text-gray-500">
          Your Heart Rate: <span className="font-bold">{heartRate.toFixed(0)} bpm</span>
        </p>
      </div>
    );
  };

  const renderLeaderboardCard = () => (
    <div className="snap-center shrink-0 w-full flex-none h-[80vh] flex items-center">
      <div className="bg-custom-bg rounded-lg shadow-lg p-6 m-2 w-full h-full border-teal-500 border-2 overflow-y-auto">
        <div className={`${instrumentSerif.className}`}>
          <h2 className="text-3xl mb-4 text-gray-900">Leaderboard</h2>
          {userRank && userRank > 10 && (
            <div className="mt-4 p-2 bg-teal-500 rounded mb-4">
              <p className="text-white">Your rank: {userRank}</p>
            </div>
          )}
          <div className="space-y-4">
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
                <span className="font-semibold text-gray-800">{entry.pace_of_aging.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const openInfoDrawer = (title: string, content: string, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    setInfoDrawerContent({ title, content });
    setIsInfoDrawerOpen(true);
  };

  const openMetricDrawer = (metric: string, event?: React.MouseEvent) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    setSelectedMetric(metric);
    setIsMetricDrawerOpen(true);
  };

  const renderAnalysisCards = () => {
    if (!analysisResult) return null;

    return (
      <>
        {/* Functional Age Card */}
        <div className="snap-center shrink-0 w-full flex-none h-[80vh] flex items-center">
          <div className="bg-custom-bg rounded-lg shadow-lg p-6 m-2 w-full h-full border-teal-500 border-2 overflow-y-auto">
            <div className={`${instrumentSerif.className}`}>
              <div className="flex items-center mb-2">
                <p className="text-3xl text-gray-900">Your Pace of Aging</p>
                <FaQuestionCircle 
                  className="ml-2 text-teal-500 cursor-pointer text-xl" 
                  onClick={(e) => openInfoDrawer(
                    "Pace of Aging",
                    "Pace of Aging is a measure of how quickly you're aging compared to the average person. A value of 1.0 means you're aging at an average rate. Values below 1.0 indicate slower aging, while values above 1.0 suggest faster aging. This is calculated based on various biomarkers including heart rate variability, skin health, and other physiological indicators.",
                    e
                  )}
                />
              </div>
              <p className="text-8xl font-bold text-teal-500 my-4">{Number(analysisResult.pace_of_aging).toFixed(2)}</p>
              <p className="text-3xl text-gray-900">
                Your{' '}
                <span 
                  onClick={(e) => openMetricDrawer('functional_age', e)}
                  className="underline cursor-pointer"
                >
                  functional age
                </span>{' '}
                is {analysisResult.functional_age}, this makes you
                <span className="text-teal-500"> {analysisResult.age_differential} </span>
                than your calendar age.
              </p>
              {renderScalingBar()}
            </div>
          </div>
        </div>

        {/* Heart Health Card */}
        <div className="snap-center shrink-0 w-full flex-none h-[80vh] flex items-center">
          <div className="bg-custom-bg rounded-lg shadow-lg p-6 m-2 w-full h-full border-teal-500 border-2 overflow-y-auto">
            <div className={`${instrumentSerif.className}`}>
              <div className="flex items-center mb-4">
                <h2 className="text-3xl text-gray-900">Your Heart Health</h2>
                <FaQuestionCircle 
                  className="ml-2 text-teal-500 cursor-pointer text-xl" 
                  onClick={(e) => openInfoDrawer(
                    "Heart Health",
                    "Heart Health is assessed through Heart Rate Variability (HRV) analysis. HRV is the variation in time between successive heartbeats and is a key indicator of overall health and fitness. Higher HRV generally indicates better cardiovascular fitness and more resilience to stress. This is calculated using advanced algorithms that analyze the subtle changes in your facial skin color that correspond to your heartbeats.",
                    e
                  )}
                />
              </div>
              <div className="flex items-baseline mb-4">
                <span className="text-8xl font-bold text-teal-500">{analysisResult.hr.toFixed(0)}</span>
                <span className="text-4xl ml-2 text-teal-500">bpm</span>
              </div>
              <p className="text-lg mb-6 text-gray-900">{analysisResult.heart_info}</p>
              <div className="grid grid-cols-4 gap-4 text-center">
                <div onClick={() => openMetricDrawer('nn50')} className="cursor-pointer">
                  <p className="text-3xl text-teal-500">{analysisResult.nn50.toFixed(1)}</p>
                  <p className="text-sm text-gray-500">nn50</p>
                </div>
                <div onClick={() => openMetricDrawer('pnn50')} className="cursor-pointer">
                  <p className="text-3xl text-teal-500">{analysisResult.pnn50.toFixed(0)}%</p>
                  <p className="text-sm text-gray-500">pnn50</p>
                </div>
                <div onClick={() => openMetricDrawer('rmssd')} className="cursor-pointer">
                  <p className="text-3xl text-teal-500">{analysisResult.rmssd.toFixed(0)}</p>
                  <p className="text-sm text-gray-500">rmssd</p>
                </div>
                <div onClick={() => openMetricDrawer('sdnn')} className="cursor-pointer">
                  <p className="text-3xl text-teal-500">{analysisResult.sdnn.toFixed(0)}</p>
                  <p className="text-sm text-gray-500">sdnn</p>
                </div>
              </div>
              {renderHeartHealthScalingBar()}
            </div>
          </div>
        </div>

        {/* Update the Skin Analysis Card to Face and Brain Insights */}
        <div className="snap-center shrink-0 w-full flex-none h-[80vh] flex items-center">
          <div className="bg-custom-bg rounded-lg shadow-lg p-6 m-2 w-full h-full border-teal-500 border-2 overflow-y-auto">
            <div className={`${instrumentSerif.className}`}>
              <div className="flex items-center mb-2">
                <p className="text-3xl text-gray-900">Your Face and Brain Insights</p>
                <FaQuestionCircle 
                  className="ml-2 text-teal-500 cursor-pointer text-xl" 
                  onClick={(e) => openInfoDrawer(
                    "Face and Brain Insights",
                    "This analysis provides insights into your skin health, sleep quality, and brain health based on visual cues from your facial image and eye movements. It includes assessments of acne, eye bags, pupil variability, and eye movement patterns, which can be indicators of overall health, stress levels, sleep quality, and cognitive function.",
                    e
                  )}
                />
              </div>
              <div className="space-y-4 mt-6">
                <div>
                  <p className="text-2xl text-gray-900">Brain Health</p>
                  <p className="text-lg text-gray-500">{analysisResult.brain_health.description}</p>
                </div>
                <div>
                  <p className="text-lg text-gray-900">Pupil Coefficient of Variation - <span className="text-teal-500 text-2xl">{analysisResult.pupil_coefficent_variation}</span></p>
                </div>
                <div>
                  <p className="text-lg text-gray-900">Estimated Saccades and Fixations - <span className="text-teal-500 text-2xl">{analysisResult.estimated_saccades_fixations}</span></p>
                </div>
                <div>
                  <p className="text-2xl text-gray-900">Acne - <span className="text-xl text-teal-500">{analysisResult.acne.score}/10</span></p>
                  <p className="text-lg text-gray-500">{analysisResult.acne.description}</p>
                </div>
                <div>
                  <p className="text-2xl text-gray-900">Sleep - <span className="text-xl text-teal-500">{analysisResult.eye_bags.score}/10</span></p>
                  <p className="text-lg text-gray-500">{analysisResult.eye_bags.description}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Leaderboard Card */}
        {hasEnteredName ? (
          renderLeaderboardCard()
        ) : (
          <div className="snap-center shrink-0 w-full flex-none h-[80vh] flex items-center justify-center">
            <div className="bg-custom-bg rounded-lg shadow-lg p-6 m-2 w-full h-full border-teal-500 border-2 overflow-y-auto flex flex-col justify-center items-center">
              <div className={`${instrumentSerif.className} text-center max-w-sm`}>
                <h2 className="text-3xl mb-4 text-gray-900">Join the Leaderboard</h2>
                <p className="mb-4 text-gray-500">Enter your name to see where you rank</p>
                <input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  className="w-full border border-gray-300 rounded-md shadow-sm p-2 text-black mb-4"
                  placeholder="Your name"
                />
                <button
                  onClick={handleAddToLeaderboard}
                  className="w-full bg-teal-500 text-white py-2 px-4 rounded-md hover:bg-teal-600 transition duration-300"
                  disabled={!userName.trim()}
                >
                  Join Leaderboard
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  };

  const renderInfoDrawerContent = () => {
    if (!infoDrawerContent) return null;

    return (
      <>
        <Drawer.Title className={`${instrumentSerif.className} font-medium mb-2 text-gray-900 text-2xl`}>
          {infoDrawerContent.title}
        </Drawer.Title>
        <p className="text-gray-600 mb-8">
          {infoDrawerContent.content}
        </p>
      </>
    );
  };

  const renderMetricDrawerContent = () => {
    if (!analysisResult || !selectedMetric) return null;

    const metricInfo = {
      nn50: {
        value: analysisResult.nn50.toFixed(1),
        info: analysisResult.nn50_info
      },
      pnn50: {
        value: `${analysisResult.pnn50.toFixed(0)}%`,
        info: analysisResult.pnn50_info
      },
      rmssd: {
        value: analysisResult.rmssd.toFixed(0),
        info: analysisResult.rmssd_info
      },
      sdnn: {
        value: analysisResult.sdnn.toFixed(0),
        info: analysisResult.sdnn_info
      },
      functional_age: {
        value: analysisResult.functional_age,
        info: "Functional age is a measure of how well your body is functioning compared to your chronological age. It takes into account various physiological and biological markers to estimate your body's 'true' age in terms of health and performance. A functional age lower than your chronological age suggests better overall health and slower aging, while a higher functional age may indicate accelerated aging or potential health issues."
      }
    };

    const selectedInfo = metricInfo[selectedMetric as keyof typeof metricInfo];

    return (
      <>
        <Drawer.Title className={`${instrumentSerif.className} font-medium mb-0 text-gray-900 text-2xl `}>
          {selectedMetric === 'functional_age' ? 'Functional Age' : selectedMetric.toUpperCase()}
        </Drawer.Title>
        <h1 className={`${instrumentSerif.className} text-4xl text-teal-500 mb-2`}>
          {selectedInfo.value}
        </h1>
        <p className="text-gray-600 mb-8">
          {selectedInfo.info}
        </p>
      </>
    );
  };

  const renderLoadingScreen = () => (
    <div className="fixed inset-0 bg-custom-bg flex flex-col items-center justify-center z-50">
      <div className={`${instrumentSerif.className} text-center`}>
        <h1 className="text-4xl text-teal-500 mb-8">Face Pace</h1>
        <div className="inline-block animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-teal-500 mb-8"></div>
        <p className="text-2xl text-teal-500 font-semibold">Analyzing your results...</p>
        <p className="text-lg text-gray-600 mt-4">This may take a few moments</p>
      </div>
    </div>
  );

  return (
    <>
      <Drawer.Root open={isInfoDrawerOpen} onOpenChange={setIsInfoDrawerOpen}>
        <main className="relative w-full h-screen flex flex-col justify-between overflow-hidden bg-custom-bg">
          {analysisStatus === 'loading' ? renderLoadingScreen() : (
            <div className="flex-grow flex flex-col justify-between h-full p-4 pt-safe pb-safe">
              <h1 className={`${instrumentSerif.className} text-3xl text-teal-500 text-center mb-0 mt-2`}>Face Pace</h1>
              <div className="flex-grow flex items-center overflow-hidden mb-4 h-[70vh] mt-2">
                <div className="relative w-full max-w-md mx-auto h-full flex items-center">
                  <div 
                    ref={cardsContainerRef} 
                    className="overflow-x-auto snap-x snap-mandatory flex w-full h-full scrollbar-hide"
                  >
                    {renderAnalysisCards()}
                  </div>
                  {currentCardIndex > 0 && (
                    <button 
                      onClick={() => handleScroll('left')} 
                      className="absolute left-0 top-1/2 transform -translate-y-1/2 bg-teal-500 rounded-full p-2 shadow-md z-10"
                    >
                      &lt;
                    </button>
                  )}
                  {currentCardIndex < totalCards - 1 && (
                    <button 
                      onClick={() => handleScroll('right')} 
                      className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-teal-500 rounded-full p-2 shadow-md z-10"
                    >
                      &gt;
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </main>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Drawer.Content className="bg-gray-100 flex flex-col rounded-t-[10px] mt-24 h-fit fixed bottom-0 left-0 right-0 outline-none z-50">
            <div className="p-4 bg-white rounded-t-[10px] flex-1">
              <div aria-hidden className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-gray-300 mb-8" />
              <div className="max-w-md mx-auto">
                {renderInfoDrawerContent()}
              </div>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>

      <Drawer.Root open={isMetricDrawerOpen} onOpenChange={setIsMetricDrawerOpen}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 bg-black/40 z-40" />
          <Drawer.Content className="bg-gray-100 flex flex-col rounded-t-[10px] mt-24 h-fit fixed bottom-0 left-0 right-0 outline-none z-50">
            <div className="p-4 bg-white rounded-t-[10px] flex-1">
              <div aria-hidden className="mx-auto w-12 h-1.5 flex-shrink-0 rounded-full bg-gray-300 mb-8" />
              <div className="max-w-md mx-auto">
                {renderMetricDrawerContent()}
              </div>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ResultsContent />
    </Suspense>
  );
}