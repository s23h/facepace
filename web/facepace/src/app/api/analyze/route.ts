import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const { videoUrl, imageUrl, age } = await request.json();

    console.log(`Analyzing video: ${videoUrl}, image: ${imageUrl}, age: ${age}`);

    if (!videoUrl || !imageUrl || !age) {
        console.error('Error: Missing video URL, image URL, or age');
        return NextResponse.json({ error: 'Missing video URL, image URL, or age' }, { status: 400 });
    }

    try {
        const response = await fetch('https://facepace-10450da4c815.herokuapp.com/pixtral_get_age', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                video_url: videoUrl,
                image_url: imageUrl,
                age: age
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // const data = await response.json();
        // Process the actual data here when the API is ready

        // For now, we'll return mock data
        const mockFunctionalAge = Math.max(20, Math.min(80, age + Math.floor(Math.random() * 21) - 10));
        const ageDifference = age - mockFunctionalAge;
        const biologicalAgeDifference = `${Math.abs(ageDifference)} years ${ageDifference > 0 ? 'younger' : 'older'}`;

        return NextResponse.json({
            result: {
                functionalAge: mockFunctionalAge,
                biologicalAgeDifference: biologicalAgeDifference,
                heartRate: 60 + Math.floor(Math.random() * 40),
                heartRateVariability: 40 + Math.floor(Math.random() * 50)
            }
        });
    } catch (error) {
        console.error('Error analyzing media:', error);
        // Return mock data in case of an error
        return NextResponse.json({
            result: {
                functionalAge: 42,
                biologicalAgeDifference: '10 years and 6 months younger',
                heartRate: 68,
                heartRateVariability: 65
            }
        });
    }
}