FROM registry.access.redhat.com/ubi9/nodejs-18 as base

USER 0

RUN yum -y update --setopt=tsflags=nodocs && \
    yum clean all

FROM base as builder

USER 0

COPY --chown=1001:0 . /tmp/src/

WORKDIR /tmp/src

RUN npm install && \
    npm run build

FROM base as final

USER 1001

RUN mkdir -p /opt/app-root/bin/companion && \
    mkdir -p /opt/app-root/bin/companion/backend && \
    mkdir -p /opt/app-root/bin/companion/frontend && \
    chown -R 1001:0 /opt/app-root/bin/companion && \
    chmod -R ug+rwx /opt/app-root/bin/companion

COPY --from=builder --chown=1001:0 /tmp/src/backend/package*.json /opt/app-root/bin/companion/backend/
COPY --from=builder --chown=1001:0 /tmp/src/frontend/package*.json /opt/app-root/bin/companion/frontend/

RUN npm install --production --prefix /opt/app-root/bin/companion/backend/ && \
    npm install --production --prefix /opt/app-root/bin/companion/frontend/

COPY --from=builder --chown=1001:0 /tmp/src/backend/dist /opt/app-root/bin/companion/backend/dist
COPY --from=builder --chown=1001:0 /tmp/src/frontend/dist /opt/app-root/bin/companion/frontend/dist

WORKDIR /opt/app-root/src

CMD ["npm", "run", "start", "--prefix", "/opt/app-root/bin/companion/backend/"]