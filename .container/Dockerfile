ARG NODE_IMAGE=node:26.13.1-bookworm-slim@sha256:5df79989ed685e09f0a98019db4cebfb22fb9df1a53c0161664a011f7ff6b0f1
ARG FRAPPE_IMAGE=frappe/erpnext:v16.60.0@sha256:0a05a56123efb2be47e429d440d07f369ed34c7a2de302e0ae7389d163867b30
FROM ${NODE_IMAGE} AS web
WORKDIR /build
COPY frontend ./frontend
RUN mkdir -p logicx_app/public/frontend logicx_app/www
RUN cd frontend && npm ci --ignore-scripts --no-audit && npm run build

FROM ${FRAPPE_IMAGE}
USER frappe
WORKDIR /home/frappe/frappe-bench
COPY --chown=frappe:frappe pyproject.toml README.md license.txt ./apps/logicx_app/
COPY --chown=frappe:frappe logicx_app ./apps/logicx_app/logicx_app
COPY --from=web --chown=frappe:frappe /build/logicx_app/public/frontend ./apps/logicx_app/logicx_app/public/frontend
COPY --from=web --chown=frappe:frappe /build/logicx_app/www/logicx_app.html ./apps/logicx_app/logicx_app/www/logicx_app.html
COPY --chown=frappe:frappe .container/release_init.py /opt/logicx/release_init.py
COPY --chown=frappe:frappe .container/verify_runtime.py /opt/logicx/verify_runtime.py
COPY --chown=frappe:frappe .container/entrypoint-release.sh /opt/logicx/entrypoint-release.sh
RUN ./env/bin/python -m ensurepip && ./env/bin/python -m pip install --no-deps -e ./apps/logicx_app \
    && printf '\nlogicx_app\n' >> sites/apps.txt \
    && ln -s /home/frappe/frappe-bench/apps/logicx_app/logicx_app/public assets/logicx_app
ENV LOGICX_MANAGED_RELEASE=1
ENTRYPOINT ["/bin/sh", "/opt/logicx/entrypoint-release.sh"]
CMD ["start.sh"]
