#!/bin/bash

# Get the directory of this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

echo "======================================================="
echo "  AI Customer Service Translator - macOS Packaging Tool"
echo "======================================================="
echo ""

# Set environment variables for Electron and Builder mirror sources
export ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/"
export ELECTRON_BUILDER_BINARIES_MIRROR="https://npmmirror.com/mirrors/electron-builder-binaries/"

echo "Step 1: Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo ""
    echo "[ERROR] npm install failed!"
    read -p "Press [Enter] to exit..."
    exit 1
fi
echo ""

echo "Step 2: Building React production bundle..."
npm run build
if [ $? -ne 0 ]; then
    echo ""
    echo "[ERROR] React build compilation failed!"
    read -p "Press [Enter] to exit..."
    exit 1
fi
echo ""

echo "Step 3: Packaging Electron app for macOS..."
npm run dist:mac
if [ $? -ne 0 ]; then
    echo ""
    echo "[ERROR] Electron packaging failed!"
    read -p "Press [Enter] to exit..."
    exit 1
fi
echo ""

echo "======================================================="
echo "  Build and packaging completed successfully!"
echo "  Outputs are located in the \"release\" directory."
echo "======================================================="
read -p "Press [Enter] to exit..."
