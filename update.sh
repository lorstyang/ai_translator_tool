#!/bin/bash

# Get the directory of this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "======================================================="
echo "  AI Customer Service Translator - macOS Update Utility"
echo "======================================================="
echo ""

# Set environment variables for Electron mirror source
export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"

echo "Step 1: Pulling latest changes from git..."
git pull
if [ $? -ne 0 ]; then
    echo ""
    echo "[ERROR] Git pull failed! Please check your network or git configuration."
    read -p "Press [Enter] to exit..."
    exit 1
fi
echo ""

echo "Step 2: Installing/updating npm dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo ""
    echo "[ERROR] npm install failed! Please review logs above."
    read -p "Press [Enter] to exit..."
    exit 1
fi
echo ""

echo "======================================================="
echo "  Update completed successfully! App is ready."
echo "======================================================="
read -p "Press [Enter] to exit..."
