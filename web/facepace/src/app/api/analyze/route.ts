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

        const data = await response.json();
        return NextResponse.json({ result: data });
    } catch (error) {
        console.error('Error analyzing media:', error);
        return NextResponse.json({ error: 'Error analyzing media' }, { status: 500 });
    }
}