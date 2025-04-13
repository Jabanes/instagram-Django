FROM python:3.10-slim-bullseye

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set working directory
WORKDIR /app

# Install Python system dependencies
RUN apt-get update && \
    apt-get install -y python3-dev build-essential && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install Python packages
COPY requirements.txt .
RUN pip install --upgrade pip setuptools wheel && \
    pip install -r requirements.txt

# Copy project files
COPY . .

# Expose port for Render
EXPOSE 8000

# Command to run the app
CMD ["gunicorn", "myproj.wsgi:application", "--bind", "0.0.0.0:8000", "--log-level=info", "--capture-output"]
