import { NextResponse } from 'next/server';

// Increase the maximum duration for this API route
export const maxDuration = 60; // 5 minutes

export async function POST(request: Request) {
    const { videoUrl, imageUrl, age } = await request.json();

    console.log(`Analyzing video: ${videoUrl}, image: ${imageUrl}, age: ${age}`);

    if (!videoUrl || !imageUrl || !age) {
        console.error('Error: Missing video URL, image URL, or age');
        return NextResponse.json({ error: 'Missing video URL, image URL, or age' }, { status: 400 });
    }

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 290000); // 4 minutes 50 seconds

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
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
        }

        const data = await response.json();
        return NextResponse.json({ result: data });
    } catch (error: unknown) {
        console.error('Error analyzing media:', error);

        if (error instanceof Error) {
            if (error.name === 'AbortError') {
                return NextResponse.json({ error: 'Request timed out after 60 seconds' }, { status: 504 });
            }
            return NextResponse.json({ error: `Error analyzing media: ${error.message}` }, { status: 500 });
        } else {
            return NextResponse.json({ error: 'An unknown error occurred' }, { status: 500 });
        }
    }
}