# ==========================================
# STAGE: Build FastAPI Backend for Render
# ==========================================
FROM python:3.10-slim

WORKDIR /app

# Install system dependencies (needed for OCR/ML libraries)
RUN apt-get update && apt-get install -y \
    tesseract-ocr \
    libgl1-mesa-glx \
    && rm -rf /var/lib/apt/lists/*

# Copy python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ ./backend/

# Expose port 8000
EXPOSE 8000

# Set working directory to backend so uvicorn runs correctly
WORKDIR /app/backend

# Command to run the application (No react static files needed)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
