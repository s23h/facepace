# Stage 1: Build Dependencies
FROM python:3.11-slim AS builder
WORKDIR /app

# Copy and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Stage 2: Final Image
FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && apt-get install -y \
    libgl1-mesa-glx \
    libglib2.0-0

ENV FLASK_APP=app.py
ENV FLASK_RUN_HOST=0.0.0.0
ENV FLASK_ENV=production

# Copy only the installed dependencies from the builder
COPY --from=builder /install /usr/local

# Copy the rest of the application code
COPY . .

ENV PORT=5000

# Command to run your application
CMD gunicorn app:app --bind 0.0.0.0:$PORT