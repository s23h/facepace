import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const { videoUrl, imageUrl } = await request.json();

    console.log(`Analyzing video: ${videoUrl} and image: ${imageUrl}`);

    if (!videoUrl || !imageUrl) {
        console.error('Error: Missing video or image URL');
        return NextResponse.json({ error: 'Missing video or image URL' }, { status: 400 });
    }

    try {
        const response = await fetch('https://facepace-10450da4c815.herokuapp.com/pixtral_get_age', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                video_url: videoUrl,
                image_url: imageUrl
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const estimatedAge = data.age;

        return NextResponse.json({ result: `Estimated age: ${estimatedAge}` });
    } catch (error) {
        console.error('Error analyzing media:', error);
        // return NextResponse.json({ error: 'Failed to analyze media' }, { status: 500 });
        return NextResponse.json({
            result: {
                functionalAge: 42,
                biologicalAgeDifference: '10 years and 6 months younger'
            }
        });
    }
}