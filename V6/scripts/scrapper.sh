#!/bin/bash
# This script is used to run the scraper
# Build the scraper image
npm run build
# Run the scraper
node dist/index.js

