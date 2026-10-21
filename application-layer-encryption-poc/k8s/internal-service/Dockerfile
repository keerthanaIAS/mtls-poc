FROM node:22-alpine
WORKDIR /app
COPY k8s/internal-service/server.js /app/internal-service/server.js
RUN mkdir -p /app/certs
EXPOSE 9443
CMD ["node", "/app/internal-service/server.js"]
