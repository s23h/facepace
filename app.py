from flask import Flask
import json
import os

app = Flask(__name__)
@app.route('/')
def index():
    return "Hello world"