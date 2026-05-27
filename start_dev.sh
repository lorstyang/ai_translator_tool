#!/bin/bash

# Get the directory of this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "======================================================="
echo "  AI Customer Service Translator - macOS Quick Start"
echo "======================================================="
echo ""

echo "Starting Electron app in development mode..."
npm run dev
STATUS=$?
if [ $STATUS -ne 0 ]; then
    echo ""
    echo "[ERROR] Application crashed or stopped with error code $STATUS."
    read -p "Press [Enter] to exit..."
fi
