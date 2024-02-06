FROM node:18-slim

# Install dependencies for the OS
RUN apt-get update && \
  apt-get install -y wget gnupg && \
  apt-get clean && \
  rm -rf /var/lib/apt/lists/*

RUN npm install -g puppeteer --unsafe-perm=true -allow-root

ARG CHROME_VERSION="google-chrome-stable"
RUN wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | apt-key add - \
  && echo "deb http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google-chrome.list \
  && apt-get update -qqy \
  && apt-get -qqy install \
  ${CHROME_VERSION:-google-chrome-stable} \
  && rm /etc/apt/sources.list.d/google-chrome.list \
  && rm -rf /var/lib/apt/lists/* /var/cache/apt/*

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY ./V6/scripts .

RUN npm install @azure/storage-blob
RUN npm install @azure/identity
WORKDIR /usr/src/app/
RUN npm install
RUN chmod +x ./scrapper.sh

# If you are building your code for production
# RUN npm ci --omit=dev

##-ENV-##

EXPOSE 8080
ENTRYPOINT [ "./scrapper.sh" ]
# ENTRYPOINT [ "/bin/bash" ]
# RUN npm run build
# CMD [ "npm", "start" ]
