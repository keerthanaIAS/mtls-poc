FROM node:22-alpine
WORKDIR /app
COPY k8s/gateway/server.js /app/gateway/server.js
RUN mkdir -p /app/certs
EXPOSE 8443
CMD ["node", "/app/gateway/server.js"]
