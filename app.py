from flask import Flask
import json

app = Flask(__name__)
@app.route('/')
def index():
    return "Hello world"

app.run()