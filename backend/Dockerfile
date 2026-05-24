FROM python:3.9-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libgomp1 \
        libglib2.0-0 \
        libgl1 \
        poppler-utils \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --default-timeout=180 -r requirements.txt

RUN python - <<'PY'
import tarfile
import urllib.request
from pathlib import Path

models = [
    (
        "https://paddleocr.bj.bcebos.com/PP-OCRv3/english/en_PP-OCRv3_det_infer.tar",
        Path("/root/.paddleocr/whl/det/en/en_PP-OCRv3_det_infer"),
        "en_PP-OCRv3_det_infer",
    ),
    (
        "https://paddleocr.bj.bcebos.com/PP-OCRv3/english/en_PP-OCRv3_rec_infer.tar",
        Path("/root/.paddleocr/whl/rec/en/en_PP-OCRv3_rec_infer"),
        "en_PP-OCRv3_rec_infer",
    ),
    (
        "https://paddleocr.bj.bcebos.com/dygraph_v2.0/ch/ch_ppocr_mobile_v2.0_cls_infer.tar",
        Path("/root/.paddleocr/whl/cls/ch_ppocr_mobile_v2.0_cls_infer"),
        "ch_ppocr_mobile_v2.0_cls_infer",
    ),
]

for url, target, inner_name in models:
    target.mkdir(parents=True, exist_ok=True)
    archive = target / f"{inner_name}.tar"
    if not archive.exists():
        urllib.request.urlretrieve(url, archive)

    with tarfile.open(archive) as tar:
        tar.extractall(target)

    inner = target / inner_name
    if inner.exists():
        for file_path in inner.iterdir():
            if file_path.is_file() and not file_path.name.startswith("._"):
                file_path.replace(target / file_path.name)

    archive.unlink(missing_ok=True)
PY

COPY . .

RUN mkdir -p /app/books /app/prepared_books /app/processed_images

EXPOSE 5000

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--timeout", "180", "server:app"]
