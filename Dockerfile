# Build on GitHub-hosted runners. In EasyPanel use the resulting image reference.
FROM node:24-alpine AS build
RUN apk add --no-cache git ffmpeg wget curl bash openssl ca-certificates python3
WORKDIR /evolution
RUN git init -q . && git remote add origin https://github.com/evolution-foundation/evolution-api.git \
 && git fetch --depth=1 origin cd800f2976e1e5b682fbf86a01ee4d85ae61f370 \
 && git checkout --detach FETCH_HEAD \
 && test "$(git rev-parse HEAD)" = "cd800f2976e1e5b682fbf86a01ee4d85ae61f370"
COPY evolution-centralflow /centralflow
COPY scripts/prepare.py /centralflow/prepare.py
RUN node /centralflow/aplicar-extensao.mjs /evolution && python3 /centralflow/prepare.py /evolution
ENV NODE_OPTIONS=--max-old-space-size=4096
RUN cp .env.example .env && npm ci --no-audit --no-fund \
 && chmod +x ./Docker/scripts/* && ./Docker/scripts/generate_database.sh && npm run build
FROM node:24-alpine AS final
RUN apk add --no-cache tzdata ffmpeg bash openssl ca-certificates
ENV TZ=America/Sao_Paulo
ENV DOCKER_ENV=true
WORKDIR /evolution
COPY --from=build /evolution/package.json ./package.json
COPY --from=build /evolution/package-lock.json ./package-lock.json
COPY --from=build /evolution/node_modules ./node_modules
COPY --from=build /evolution/dist ./dist
COPY --from=build /evolution/prisma ./prisma
COPY --from=build /evolution/manager ./manager
COPY --from=build /evolution/public ./public
COPY --from=build /evolution/.env ./.env
COPY --from=build /evolution/Docker ./Docker
COPY --from=build /evolution/runWithProvider.js ./runWithProvider.js
COPY --from=build /evolution/tsup.config.ts ./tsup.config.ts
COPY evolution-centralflow /opt/centralflow-source
COPY LICENSES /usr/share/licenses/centralflow
COPY LICENSE NOTICE /usr/share/licenses/centralflow/
ARG SOURCE_URL=https://github.com/seifando/centralflow-evolution-api
ARG REVISION=local-unpublished
LABEL org.opencontainers.image.source=$SOURCE_URL org.opencontainers.image.revision=$REVISION \
 io.centralflow.protocol="centralflow-publishing/1" io.centralflow.upstream="evolution-api:2.3.7" io.centralflow.version="0.6.1"
EXPOSE 8080
ENTRYPOINT ["/bin/bash","-c",". ./Docker/scripts/deploy_database.sh && npm run start:prod"]
