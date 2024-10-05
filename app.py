from flask import Flask
import json
import os
from flask.json import jsonify
from mistralai import Mistral
from requests import request

app = Flask(__name__)
@app.route('/')
def index():
    return "Hello world"

@app.route('/pixtral_get_age', methods=['POST'])
def pixtral_get_age():
    data = request.get_json()
    image_url = data.get('image_url')
    if not image_url:
        return jsonify({'error': 'Image URL is required'}), 400

    mistral = Mistral(api_key="OURAYTRBvuZ4rtmVs0Wlm4eRUgMsS40M")
    response = mistral.chat.complete(
        model="pixtral-12b",
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "What is the age of this person? Output a singular number."
                    },
                    {
                        "type": "image_url",
                        "image_url": image_url
                    }
                ]
            }
        ]
    )

    if response.choices:
        age = response.choices[0].message.content
        return jsonify({'age': age}), 200
    else:
        return jsonify({'error': 'Failed to determine age'}), 500