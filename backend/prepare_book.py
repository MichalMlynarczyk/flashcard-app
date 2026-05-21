import argparse
import json
import math
import os
import re
import shutil
import subprocess
from pathlib import Path

import fitz


BASE_DIR = Path(__file__).resolve().parent
BOOKS_DIR = BASE_DIR / "books"
OUTPUT_DIR = BASE_DIR / "prepared_books"
WORD_PATTERN = re.compile(r"[A-Za-z]+(?:[-'][A-Za-z]+)?")


def get_ocr_value(source, key, default=None):
    if isinstance(source, dict):
        return source.get(key, default)

    if hasattr(source, "get"):
        try:
            return source.get(key, default)
        except TypeError:
            return default

    return default


def box_to_points(box):
    if box is None:
        return []

    if hasattr(box, "tolist"):
        box = box.tolist()

    if len(box) == 4 and all(isinstance(value, (int, float)) for value in box):
        x1, y1, x2, y2 = box
        return [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]

    points = []

    for point in box:
        if hasattr(point, "tolist"):
            point = point.tolist()

        if isinstance(point, (list, tuple)) and len(point) >= 2:
            points.append([float(point[0]), float(point[1])])

    return points


def iter_ocr_items(result):
    if not result:
        return

    pages = result if isinstance(result, list) else [result]

    for page in pages:
        texts = get_ocr_value(page, "rec_texts")

        if texts is not None:
            scores = get_ocr_value(page, "rec_scores", [])
            boxes = (
                get_ocr_value(page, "rec_polys")
                or get_ocr_value(page, "dt_polys")
                or get_ocr_value(page, "rec_boxes")
                or []
            )

            for index, text in enumerate(texts):
                if not text:
                    continue

                yield {
                    "text": text,
                    "confidence": float(scores[index]) if index < len(scores) else 1.0,
                    "points": box_to_points(boxes[index]) if index < len(boxes) else [],
                }

            continue

        if not page:
            continue

        for line in page:
            if not isinstance(line, (list, tuple)) or len(line) < 2:
                continue

            recognition = line[1]

            if isinstance(recognition, (list, tuple)) and recognition:
                text = recognition[0]
                confidence = recognition[1] if len(recognition) > 1 else 1.0
            else:
                text = recognition
                confidence = 1.0

            if not text:
                continue

            yield {
                "text": text,
                "confidence": float(confidence),
                "points": box_to_points(line[0]),
            }


def slugify(value):
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value.lower()).strip("-")
    return slug or "book"


def count_pdf_pages(pdf_path):
    result = subprocess.run(
        ["pdfinfo", str(pdf_path)],
        capture_output=True,
        check=True,
        text=True,
    )

    match = re.search(r"^Pages:\s+(\d+)", result.stdout, re.MULTILINE)

    if not match:
        raise RuntimeError(f"Nie udało się odczytać liczby stron: {pdf_path}")

    return int(match.group(1))


def render_page(pdf_path, page_number, output_path, dpi):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_prefix = output_path.with_suffix("")

    subprocess.run(
        [
            "pdftoppm",
            "-f",
            str(page_number),
            "-l",
            str(page_number),
            "-singlefile",
            "-png",
            "-r",
            str(dpi),
            str(pdf_path),
            str(output_prefix),
        ],
        capture_output=True,
        check=True,
    )


def render_page_from_document(document, page_number, output_path, dpi):
    output_path.parent.mkdir(parents=True, exist_ok=True)
    page = document.load_page(page_number - 1)
    pixmap = page.get_pixmap(dpi=dpi, alpha=False)
    pixmap.save(str(output_path))

    return pixmap.width, pixmap.height


def extract_words_from_pdf_page(document, page_number, dpi):
    page = document.load_page(page_number - 1)
    scale = dpi / 72
    words = []

    for x0, y0, x1, y1, text, *_ in page.get_text("words"):
        text_length = max(len(text), 1)

        for match in WORD_PATTERN.finditer(text):
            word = match.group(0)
            word_x0 = x0 + (x1 - x0) * (match.start() / text_length)
            word_width = (x1 - x0) * (len(word) / text_length)

            words.append(
                {
                    "text": word,
                    "x": word_x0 * scale,
                    "y": y0 * scale,
                    "width": max(word_width * scale, 12),
                    "height": max((y1 - y0) * scale, 12),
                    "confidence": 1.0,
                }
            )

    rect = page.rect

    return {
        "width": math.ceil(rect.width * scale),
        "height": math.ceil(rect.height * scale),
        "words": words,
    }


def extract_words_from_image(ocr, image_path):
    import cv2

    image = cv2.imread(str(image_path))

    if image is None:
        raise RuntimeError(f"Nie udało się wczytać strony: {image_path}")

    height, width = image.shape[:2]
    try:
        result = ocr.ocr(str(image_path), cls=True)
    except TypeError as error:
        if "cls" not in str(error):
            raise

        result = ocr.ocr(str(image_path))
    words = []

    for item in iter_ocr_items(result):
        text = item["text"]
        confidence = item["confidence"]
        box = item["points"]

        if len(box) < 2:
            continue

        xs = [point[0] for point in box]
        ys = [point[1] for point in box]
        x_min = min(xs)
        x_max = max(xs)
        y_min = min(ys)
        y_max = max(ys)
        text_length = max(len(text), 1)

        for match in WORD_PATTERN.finditer(text):
            word = match.group(0)
            word_x = x_min + (x_max - x_min) * (
                match.start() / text_length
            )
            word_width = (x_max - x_min) * (len(word) / text_length)

            words.append(
                {
                    "text": word,
                    "x": word_x,
                    "y": y_min,
                    "width": max(word_width, 12),
                    "height": max(y_max - y_min, 12),
                    "confidence": confidence,
                }
            )

    return {
        "width": width,
        "height": height,
        "words": words,
    }


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)

    with path.open("w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=2)
        file.write("\n")


def prepare_book(args):
    pdf_path = Path(args.pdf)

    if not pdf_path.is_absolute():
        pdf_path = BOOKS_DIR / pdf_path

    if not pdf_path.exists():
        raise FileNotFoundError(f"Nie znaleziono PDF: {pdf_path}")

    title = args.title or pdf_path.stem
    book_id = args.book_id or slugify(title)
    book_dir = OUTPUT_DIR / book_id
    pages_dir = book_dir / "pages"
    words_dir = book_dir / "words"
    page_count = count_pdf_pages(pdf_path)
    start_page = max(args.start_page, 1)
    end_page = page_count

    if args.max_pages:
        end_page = min(page_count, start_page + args.max_pages - 1)

    if args.clean and book_dir.exists():
        shutil.rmtree(book_dir)

    book_dir.mkdir(parents=True, exist_ok=True)
    pages_dir.mkdir(parents=True, exist_ok=True)
    words_dir.mkdir(parents=True, exist_ok=True)

    meta = {
        "id": book_id,
        "title": title,
        "sourcePdf": pdf_path.name,
        "pageCount": page_count,
        "preparedPages": {
            "start": start_page,
            "end": end_page,
        },
        "dpi": args.dpi,
    }
    write_json(book_dir / "meta.json", meta)

    document = None
    ocr = None

    if args.text_layer:
        document = fitz.open(pdf_path)
    else:
        from paddleocr import PaddleOCR

        ocr = PaddleOCR(use_angle_cls=True, lang="en")

    for page_number in range(start_page, end_page + 1):
        page_name = f"{page_number:04d}"
        image_path = pages_dir / f"{page_name}.png"
        words_path = words_dir / f"{page_name}.json"

        if args.force or not image_path.exists():
            print(f"[{page_number}/{page_count}] Renderuję PNG...")
            if document:
                render_page_from_document(document, page_number, image_path, args.dpi)
            else:
                render_page(pdf_path, page_number, image_path, args.dpi)
        else:
            print(f"[{page_number}/{page_count}] PNG już istnieje.")

        if args.force or not words_path.exists():
            if document:
                print(f"[{page_number}/{page_count}] Wyciągam słowa z PDF...")
                words_data = extract_words_from_pdf_page(document, page_number, args.dpi)
            else:
                print(f"[{page_number}/{page_count}] Robię OCR...")
                words_data = extract_words_from_image(ocr, image_path)
            words_data["page"] = page_number
            write_json(words_path, words_data)
            print(
                f"[{page_number}/{page_count}] Zapisano "
                f"{len(words_data['words'])} słów."
            )
        else:
            print(f"[{page_number}/{page_count}] JSON słów już istnieje.")

    if document:
        document.close()

    print(f"Gotowe: {book_dir}")


def parse_args():
    parser = argparse.ArgumentParser(
        description="Przygotowuje książkę PDF do szybkiego czytania w appce."
    )
    parser.add_argument("pdf", help="Nazwa PDF z backend/books albo pełna ścieżka.")
    parser.add_argument("--title", help="Tytuł książki w meta.json.")
    parser.add_argument("--book-id", help="Id folderu wyjściowego.")
    parser.add_argument("--dpi", type=int, default=140)
    parser.add_argument("--start-page", type=int, default=1)
    parser.add_argument("--max-pages", type=int)
    parser.add_argument(
        "--text-layer",
        action="store_true",
        help="Czyta słowa bezpośrednio z warstwy tekstowej PDF zamiast OCR.",
    )
    parser.add_argument("--force", action="store_true", help="Nadpisuje strony/JSON.")
    parser.add_argument("--clean", action="store_true", help="Czyści folder książki.")

    return parser.parse_args()


if __name__ == "__main__":
    prepare_book(parse_args())
