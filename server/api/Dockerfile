FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /srv
COPY server/api/requirements.txt /srv/requirements.txt
RUN pip install --no-cache-dir -r /srv/requirements.txt \
  && groupadd --gid 10001 memrly && useradd --uid 10001 --gid 10001 --no-create-home memrly \
  && mkdir -p /data/files && chown 10001:10001 /data/files
COPY server/api/memrly_api /srv/memrly_api
USER 10001:10001
EXPOSE 8000
CMD ["uvicorn","memrly_api.main:app","--host","0.0.0.0","--port","8000"]
