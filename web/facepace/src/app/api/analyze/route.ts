import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const { imageUrl } = await request.json();

    console.log('Analyzing image:', imageUrl);

    if (!imageUrl) {
        console.error('Error: No image URL provided');
        return NextResponse.json({ error: 'No image URL provided' }, { status: 400 });
    }

    try {
        const response = await fetch('https://facepace-10450da4c815.herokuapp.com/pixtral_get_age', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ image_url: imageUrl }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        const estimatedAge = data.age;

        return NextResponse.json({ result: `Estimated age: ${estimatedAge}` });
    } catch (error) {
        console.error('Error analyzing image:', error);
        return NextResponse.json({ error: 'Failed to analyze image' }, { status: 500 });
    }
}