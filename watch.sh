#!/bin/bash
set -e
echo "==> Generating templ files..."
templ generate

echo "==> Starting Tailwind watcher and Go server..."
# Start Tailwind in watch mode (background)
./tailwindcss -i ./static/css/input.css -o ./static/css/output.css --watch &
TAILWIND_PID=$!

# Start the Go server
go run main.go

