# https://javascript.plainenglish.io/build-a-production-ready-node-express-api-with-docker-9a45443427a0
ARG PORT=3000

FROM node:16-buster-slim

# Builder stage

FROM node AS builder

# Use /app as the CWD
WORKDIR /app            

# Copy package.json and package-lock.json to /app
COPY package*.json ./   

# Install all dependencies
RUN npm i               

# Copy the rest of the code
COPY . .                   

# Open desired port
EXPOSE ${PORT}

# Run development server
ENTRYPOINT [ "npm", "run", "start" ]

# Final stage

FROM node AS final

# Set node environment to production
ENV NODE_ENV production

# Update the system
RUN apt-get update && apt-get -y upgrade

# https://www.cloudsavvyit.com/13461/how-to-run-puppeteer-and-headless-chrome-in-a-docker-container/
RUN apt-get install -y \
    fonts-liberation \
    gconf-service \
#    libappindicator1 \
    libasound2 \
    libatk1.0-0 \
    libcairo2 \
    libcups2 \
    libfontconfig1 \
    libgbm-dev \
    libgdk-pixbuf2.0-0 \
    libgtk-3-0 \
    libicu-dev \
    libjpeg-dev \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libpng-dev \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    xdg-utils

# Prepare destination directory and ensure user node owns it
RUN mkdir -p /home/node/app/ && chown -R node:node /home/node/app

# Set CWD
WORKDIR /home/node/app

# Install PM2
RUN npm i -g pm2

# Copy package.json, package-lock.json and process.yml
COPY --chown=node:node package*.json ./container/process.yml ./

# Switch to user node
USER node

# Install libraries as user node
RUN npm i --only=production

# Copy js files and change ownership to user node
COPY --chown=node:node --from=builder /app/ ./

# Make chrome binary executable
RUN chmod -R o+rwx /home/node/app/node_modules/puppeteer/.local-chromium

# Open desired port
EXPOSE ${PORT}

# Use PM2 to run the application as stated in config file
ENTRYPOINT ["pm2-runtime", "./process.yml"] 