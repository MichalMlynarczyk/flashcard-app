from flask import Flask, request, send_file, send_from_directory
from flask_cors import CORS
import cv2
import numpy as np
import tempfile
import os
import re
import subprocess
import secrets
import hashlib
import traceback
from collections.abc import Mapping
from flask import jsonify
from paddleocr import PaddleOCR
import sqlite3
import json
import fitz
from openai import OpenAI
from dotenv import load_dotenv
from werkzeug.security import check_password_hash, generate_password_hash
load_dotenv()

OUTPUT_DIR = "processed_images"
os.makedirs(OUTPUT_DIR, exist_ok=True)
openai_client = None

BASE_DIR = os.path.dirname(
    os.path.abspath(__file__)
)

DB_PATH = os.path.join(
    BASE_DIR,
    "wordse.db"
)
BOOKS_DIR = os.path.join(
    BASE_DIR,
    "books"
)
PREPARED_BOOKS_DIR = os.path.join(
    BASE_DIR,
    "prepared_books"
)
print(DB_PATH)

STARTER_WORDS = [
    ("chapter", "rozdział"),
    ("page", "strona"),
    ("sentence", "zdanie"),
    ("meaning", "znaczenie"),
    ("wizard", "czarodziej"),
    ("castle", "zamek"),
    ("letter", "list"),
    ("friend", "przyjaciel"),
    ("lesson", "lekcja"),
    ("story", "historia"),
]
GUEST_WORD_BASES = [
    {
        "id": 0,
        "name": "Książki",
    }
]


def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("PRAGMA foreign_keys = OFF")

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS auth_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            token_hash TEXT NOT NULL UNIQUE,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
                ON DELETE CASCADE
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS word_bases (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            user_id INTEGER,
            FOREIGN KEY (user_id) REFERENCES users(id)
                ON DELETE CASCADE
        )
    """)

    cursor.execute("PRAGMA table_info(word_bases)")
    base_columns = [column[1] for column in cursor.fetchall()]

    cursor.execute(
        "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'word_bases'"
    )
    word_bases_sql_row = cursor.fetchone()
    word_bases_sql = word_bases_sql_row[0] if word_bases_sql_row else ""

    if "user_id" not in base_columns or "UNIQUE" in (word_bases_sql or "").upper():
        cursor.execute("ALTER TABLE word_bases RENAME TO word_bases_old")
        cursor.execute("""
            CREATE TABLE word_bases (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                user_id INTEGER,
                FOREIGN KEY (user_id) REFERENCES users(id)
                    ON DELETE CASCADE
            )
        """)
        cursor.execute("""
            INSERT INTO word_bases (id, name, user_id)
            SELECT id, name, NULL
            FROM word_bases_old
        """)
        cursor.execute("DROP TABLE word_bases_old")

    cursor.execute("PRAGMA table_info(words)")
    word_columns = [column[1] for column in cursor.fetchall()]

    if word_columns and "base_id" not in word_columns:
        cursor.execute("DROP TABLE words")

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS words (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            english TEXT NOT NULL,
            polish TEXT NOT NULL,
            base_id INTEGER NOT NULL,
            user_id INTEGER,
            FOREIGN KEY (base_id) REFERENCES word_bases(id)
                ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id)
                ON DELETE CASCADE
        )
    """)

    cursor.execute("PRAGMA table_info(words)")
    word_columns = [column[1] for column in cursor.fetchall()]

    if "user_id" not in word_columns:
        cursor.execute("ALTER TABLE words ADD COLUMN user_id INTEGER")

    cursor.execute("""
        UPDATE words
        SET user_id = (
            SELECT word_bases.user_id
            FROM word_bases
            WHERE word_bases.id = words.base_id
        )
        WHERE user_id IS NULL
    """)

    cursor.execute("""
        CREATE UNIQUE INDEX IF NOT EXISTS idx_word_bases_owner_name
        ON word_bases (COALESCE(user_id, 0), name)
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_words_owner
        ON words (user_id)
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS study_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            base_id INTEGER,
            words_count INTEGER NOT NULL,
            stages_count INTEGER NOT NULL,
            completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
                ON DELETE CASCADE,
            FOREIGN KEY (base_id) REFERENCES word_bases(id)
                ON DELETE SET NULL
        )
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_study_sessions_owner_completed
        ON study_sessions (user_id, completed_at)
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS learned_words (
            user_id INTEGER NOT NULL,
            word_id INTEGER NOT NULL,
            first_learned_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (user_id, word_id),
            FOREIGN KEY (user_id) REFERENCES users(id)
                ON DELETE CASCADE,
            FOREIGN KEY (word_id) REFERENCES words(id)
                ON DELETE CASCADE
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS study_cycle_achievements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            base_id INTEGER,
            cycle_number INTEGER NOT NULL,
            words_count INTEGER NOT NULL,
            new_words_count INTEGER NOT NULL,
            review_words_count INTEGER NOT NULL,
            completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
                ON DELETE CASCADE,
            FOREIGN KEY (base_id) REFERENCES word_bases(id)
                ON DELETE SET NULL
        )
    """)
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_study_cycle_achievements_owner_completed
        ON study_cycle_achievements (user_id, completed_at)
    """)

    cursor.execute("""
        INSERT OR IGNORE INTO word_bases (name, user_id)
        VALUES (?, NULL)
    """, ("Książki",))
    cursor.execute(
        """
        SELECT id
        FROM word_bases
        WHERE name = ?
            AND user_id IS NULL
        """,
        ("Książki",)
    )
    starter_base_row = cursor.fetchone()
    starter_base_id = starter_base_row[0] if starter_base_row else None

    if starter_base_id:
        for english, polish in STARTER_WORDS:
            cursor.execute(
                """
                INSERT INTO words (english, polish, base_id, user_id)
                SELECT ?, ?, ?, NULL
                WHERE NOT EXISTS (
                    SELECT 1
                    FROM words
                    WHERE english = ?
                        AND polish = ?
                        AND base_id = ?
                        AND user_id IS NULL
                )
                """,
                (english, polish, starter_base_id, english, polish, starter_base_id)
            )

    conn.commit()
    cursor.execute("PRAGMA foreign_keys = ON")
    conn.close()

app = Flask(__name__)
init_db()
CORS(app)

ocr = None

LAST_BITMAP = None
LAST_FULL_BITMAP = None
LAST_CLEAN_IMAGE = None
LAST_FULL_CLEAN_IMAGE = None


def get_ocr():
    global ocr

    if ocr is None:
        ocr = PaddleOCR(
            use_angle_cls=True,
            lang="en",
            enable_mkldnn=False,
        )

    return ocr


def get_openai_client():
    global openai_client

    if openai_client is None:
        openai_client = OpenAI()

    return openai_client


def run_ocr(image):
    if isinstance(image, np.ndarray) and len(image.shape) == 2:
        image = cv2.cvtColor(image, cv2.COLOR_GRAY2BGR)

    try:
        return get_ocr().ocr(image, cls=True)
    except TypeError as error:
        if "cls" not in str(error):
            raise

        return get_ocr().ocr(image)


def normalize_ocr_text(text):
    return re.sub(r"\s+", " ", (text or "").strip()).lower()


def collect_ocr_items_from_images(images):
    items = []
    seen_texts = set()

    for image in images:
        if image is None:
            continue

        result = run_ocr(image)

        for item in iter_ocr_items(result):
            text_key = normalize_ocr_text(item.get("text"))

            if not text_key or text_key in seen_texts:
                continue

            seen_texts.add(text_key)
            items.append(item)

    return items


def as_ocr_mapping(source):
    if isinstance(source, Mapping):
        return source

    for method_name in ("to_dict", "dict"):
        method = getattr(source, method_name, None)

        if callable(method):
            try:
                value = method()
            except TypeError:
                continue

            if isinstance(value, Mapping):
                return value

    try:
        value = dict(source)
    except (TypeError, ValueError):
        return None

    return value if isinstance(value, Mapping) else None


def get_ocr_value(source, key, default=None):
    mapping = as_ocr_mapping(source)

    if mapping is None:
        return default

    return mapping.get(key, default)


def first_ocr_value(source, keys):
    for key in keys:
        value = get_ocr_value(source, key)

        if value is not None:
            return value

    return []


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
        page_mapping = as_ocr_mapping(page)
        texts = page_mapping.get("rec_texts") if page_mapping else None

        if texts is not None:
            scores = page_mapping.get("rec_scores", [])
            boxes = first_ocr_value(
                page_mapping,
                ("rec_polys", "dt_polys", "rec_boxes")
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

        if not isinstance(page, (list, tuple)) or len(page) == 0:
            continue

        for line in page:
            if isinstance(line, dict) or hasattr(line, "get"):
                text = (
                    get_ocr_value(line, "text")
                    or get_ocr_value(line, "rec_text")
                    or get_ocr_value(line, "transcription")
                )

                if not text:
                    continue

                yield {
                    "text": text,
                    "confidence": float(
                        get_ocr_value(line, "confidence")
                        or get_ocr_value(line, "score")
                        or get_ocr_value(line, "rec_score")
                        or 1.0
                    ),
                    "points": box_to_points(
                        get_ocr_value(line, "points")
                        or get_ocr_value(line, "box")
                        or get_ocr_value(line, "poly")
                    ),
                }

                continue

            if not isinstance(line, (list, tuple)) or len(line) < 2:
                continue

            box = line[0]
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
                "points": box_to_points(box),
            }


def read_json_file(path):
    with open(path, "r", encoding="utf-8") as file:
        return json.load(file)


def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def normalize_email(email):
    return (email or "").strip().lower()


def hash_token(token):
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def serialize_user(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"],
        "createdAt": row["created_at"],
        "plan": "unlimited",
    }


def get_auth_user():
    header = request.headers.get("Authorization", "")

    if not header.startswith("Bearer "):
        return None

    token = header.removeprefix("Bearer ").strip()

    if not token:
        return None

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT users.id, users.name, users.email, users.created_at
        FROM auth_sessions
        JOIN users ON users.id = auth_sessions.user_id
        WHERE auth_sessions.token_hash = ?
        """,
        (hash_token(token),)
    )

    user = cursor.fetchone()
    conn.close()

    return user


def get_request_user_id():
    user = get_auth_user()
    return user["id"] if user else None


def auth_required_response():
    return jsonify({"error": "Zaloguj się, żeby zapisywać zmiany."}), 401


def create_auth_session(cursor, user_id):
    token = secrets.token_urlsafe(32)

    cursor.execute(
        """
        INSERT INTO auth_sessions (user_id, token_hash)
        VALUES (?, ?)
        """,
        (user_id, hash_token(token))
    )

    return token


def seed_user_starter_words(cursor, user_id):
    base_id = get_or_create_base(cursor, "Książki", user_id)

    for english, polish in STARTER_WORDS:
        cursor.execute(
            """
            INSERT INTO words (english, polish, base_id, user_id)
            SELECT ?, ?, ?, ?
            WHERE NOT EXISTS (
                SELECT 1
                FROM words
                WHERE english = ?
                    AND polish = ?
                    AND base_id = ?
                    AND user_id = ?
            )
            """,
            (english, polish, base_id, user_id, english, polish, base_id, user_id)
        )


def get_prepared_book_dirs():
    if not os.path.isdir(PREPARED_BOOKS_DIR):
        return []

    book_dirs = []

    for dirname in sorted(os.listdir(PREPARED_BOOKS_DIR)):
        book_dir = os.path.join(PREPARED_BOOKS_DIR, dirname)
        meta_path = os.path.join(book_dir, "meta.json")

        if os.path.isdir(book_dir) and os.path.isfile(meta_path):
            book_dirs.append(book_dir)

    return book_dirs


def get_prepared_books():
    books = []

    for book_dir in get_prepared_book_dirs():
        try:
            meta = read_json_file(os.path.join(book_dir, "meta.json"))
        except (OSError, json.JSONDecodeError) as error:
            print("ERROR read prepared book meta:", error)
            continue

        book_id = meta.get("id") or os.path.basename(book_dir)
        prepared_pages = meta.get("preparedPages") or {}
        prepared_end = prepared_pages.get("end")
        page_count = prepared_end or meta.get("pageCount") or 0

        books.append({
            "filename": book_id,
            "title": meta.get("title") or book_id,
            "pageCount": page_count,
            "fullPageCount": meta.get("pageCount") or page_count,
            "sourcePdf": meta.get("sourcePdf"),
            "prepared": True,
            "previewUrl": f"/api/books/{book_id}"
        })

    return books


def get_prepared_book(book_id):
    for book in get_prepared_books():
        if book["filename"] == book_id:
            return book

    return None


def get_prepared_page_path(book_id, page):
    return os.path.join(
        PREPARED_BOOKS_DIR,
        book_id,
        "pages",
        f"{page:04d}.png"
    )


def get_prepared_words_path(book_id, page):
    return os.path.join(
        PREPARED_BOOKS_DIR,
        book_id,
        "words",
        f"{page:04d}.json"
    )


def get_pdf_books():
    if not os.path.isdir(BOOKS_DIR):
        return []

    books = []

    for filename in sorted(os.listdir(BOOKS_DIR)):
        if not filename.lower().endswith(".pdf"):
            continue

        books.append({
            "filename": filename,
            "title": os.path.splitext(filename)[0],
            "pageCount": count_pdf_pages(os.path.join(BOOKS_DIR, filename)),
            "previewUrl": f"/api/books/{filename}"
        })

    return books


def get_books_catalog():
    prepared_books = get_prepared_books()
    prepared_source_pdfs = {
        book.get("sourcePdf")
        for book in prepared_books
        if book.get("sourcePdf")
    }
    pdf_books = [
        book
        for book in get_pdf_books()
        if book["filename"] not in prepared_source_pdfs
    ]

    return prepared_books + pdf_books


def count_pdf_pages(path):
    try:
        result = subprocess.run(
            ["pdfinfo", path],
            capture_output=True,
            check=True,
            text=True
        )

        match = re.search(r"^Pages:\s+(\d+)", result.stdout, re.MULTILINE)

        return int(match.group(1)) if match else 0
    except (OSError, subprocess.CalledProcessError):
        return 0


def render_pdf_page(filename, page, dpi=140):
    available_books = {
        book["filename"]: book
        for book in get_pdf_books()
    }

    book = available_books.get(filename)

    if book is None:
        return None, None

    page_count = book["pageCount"] or 1
    page = min(max(page, 1), page_count)
    pdf_path = os.path.join(BOOKS_DIR, filename)
    output_prefix = tempfile.NamedTemporaryFile(delete=True).name
    output_path = f"{output_prefix}.png"

    subprocess.run(
        [
            "pdftoppm",
            "-f",
            str(page),
            "-l",
            str(page),
            "-singlefile",
            "-png",
            "-r",
            str(dpi),
            pdf_path,
            output_prefix
        ],
        capture_output=True,
        check=True
    )

    return output_path, book


def get_pdf_page_text(filename, page):
    if not filename:
        return ""

    pdf_path = os.path.join(BOOKS_DIR, filename)

    if not os.path.isfile(pdf_path):
        return ""

    try:
        with fitz.open(pdf_path) as document:
            if page < 1 or page > document.page_count:
                return ""

            text = document.load_page(page - 1).get_text("text") or ""
            return re.sub(r"\s+", " ", text).strip()
    except Exception as error:
        print("ERROR read pdf page text:", error)
        return ""


@app.route("/api/books", methods=["GET"])
def get_books():
    return jsonify({"books": get_books_catalog()})


@app.route("/api/books/<path:filename>/pages/<int:page>", methods=["GET"])
def preview_book_page(filename, page):
    prepared_book = get_prepared_book(filename)

    if prepared_book:
        prepared_page_path = get_prepared_page_path(filename, page)

        if os.path.isfile(prepared_page_path):
            return send_file(prepared_page_path, mimetype="image/png")

        source_pdf = prepared_book.get("sourcePdf")

        if not source_pdf:
            return jsonify({"error": "Nie przygotowano tej strony."}), 404

        filename = source_pdf

    try:
        output_path, book = render_pdf_page(filename, page)
    except (OSError, subprocess.CalledProcessError) as error:
        print("ERROR render pdf page:", error)
        return jsonify({"error": "Nie udało się wyrenderować strony."}), 500

    if book is None:
        return jsonify({"error": "Nie znaleziono książki."}), 404

    return send_file(output_path, mimetype="image/png")


@app.route("/api/books/<path:filename>/pages/<int:page>/words", methods=["GET"])
def get_book_page_words(filename, page):
    prepared_book = get_prepared_book(filename)

    if prepared_book:
        prepared_words_path = get_prepared_words_path(filename, page)

        if os.path.isfile(prepared_words_path):
            try:
                words_data = read_json_file(prepared_words_path)
                words_data["pageText"] = get_pdf_page_text(
                    prepared_book.get("sourcePdf"),
                    page
                )
                return jsonify(words_data)
            except (OSError, json.JSONDecodeError) as error:
                print("ERROR read prepared page words:", error)
                return jsonify({"error": "Nie udało się odczytać słów."}), 500

        source_pdf = prepared_book.get("sourcePdf")

        if not source_pdf:
            return jsonify({"error": "Nie przygotowano słów dla tej strony."}), 404

        filename = source_pdf

    try:
        output_path, book = render_pdf_page(filename, page)
    except (OSError, subprocess.CalledProcessError) as error:
        print("ERROR render pdf page for OCR:", error)
        return jsonify({"error": "Nie udało się wyrenderować strony."}), 500

    if book is None:
        return jsonify({"error": "Nie znaleziono książki."}), 404

    image = cv2.imread(output_path)

    if image is None:
        return jsonify({"error": "Nie udało się wczytać strony."}), 500

    height, width = image.shape[:2]
    result = run_ocr(output_path)
    words = []

    if not result:
        return jsonify({
            "width": width,
            "height": height,
            "words": words
        })

    for item in iter_ocr_items(result):
        text = item["text"]
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

        for match in re.finditer(r"[A-Za-z]+(?:[-'][A-Za-z]+)?", text):
            word = match.group(0)
            word_x = x_min + (x_max - x_min) * (match.start() / text_length)
            word_width = (x_max - x_min) * (len(word) / text_length)

            words.append({
                "text": word,
                "x": word_x,
                "y": y_min,
                "width": max(word_width, 12),
                "height": max(y_max - y_min, 12)
            })

    return jsonify({
        "width": width,
        "height": height,
        "pageText": get_pdf_page_text(filename, page),
        "words": words
    })


@app.route("/api/books/<path:filename>", methods=["GET"])
def preview_book(filename):
    prepared_book = get_prepared_book(filename)

    if prepared_book:
        first_page_path = get_prepared_page_path(filename, 1)

        if os.path.isfile(first_page_path):
            return send_file(first_page_path, mimetype="image/png")

        return jsonify({"error": "Nie znaleziono podglądu książki."}), 404

    available_filenames = {
        book["filename"]
        for book in get_pdf_books()
    }

    if filename not in available_filenames:
        return jsonify({"error": "Nie znaleziono książki."}), 404

    return send_from_directory(
        BOOKS_DIR,
        filename,
        mimetype="application/pdf"
    )







def save_words(words, base_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print("Do zapisania:", words)

    for word in words:
        print(
            f"Zapisuję: {word['english']} -> {word['polish']}"
        )

        cursor.execute(
            """
            INSERT INTO words
            (english, polish, base_id)
            VALUES (?, ?, ?)
            """,
            (
                word["english"],
                word["polish"],
                base_id
            )
        )

    conn.commit()

    print("Zapisano:", len(words))

    conn.close()


def parse_positive_int(value, default, max_value=None):
    try:
        number = int(value)
    except (TypeError, ValueError):
        number = default

    number = max(number, 1)

    if max_value is not None:
        number = min(number, max_value)

    return number


def serialize_word(row):
    return {
        "id": row["id"],
        "english": row["english"],
        "polish": row["polish"],
        "baseId": row["base_id"],
        "baseName": row["base_name"]
    }


def serialize_base(row):
    return {
        "id": row["id"],
        "name": row["name"]
    }


def serialize_study_session(row):
    return {
        "id": row["id"],
        "baseId": row["base_id"],
        "baseName": row["base_name"] or "Wszystkie",
        "wordsCount": row["words_count"],
        "stagesCount": row["stages_count"],
        "completedAt": row["completed_at"],
    }


def serialize_study_cycle(row):
    return {
        "id": row["id"],
        "baseId": row["base_id"],
        "baseName": row["base_name"] or "Wszystkie",
        "cycleNumber": row["cycle_number"],
        "wordsCount": row["words_count"],
        "newWordsCount": row["new_words_count"],
        "reviewWordsCount": row["review_words_count"],
        "completedAt": row["completed_at"],
    }


def get_or_create_base(cursor, name, user_id=None):
    base_name = (name or "").strip()

    if not base_name:
        return None

    cursor.execute(
        """
        INSERT OR IGNORE INTO word_bases (name, user_id)
        VALUES (?, ?)
        """,
        (base_name, user_id)
    )

    cursor.execute(
        """
        SELECT id
        FROM word_bases
        WHERE name = ?
            AND COALESCE(user_id, 0) = COALESCE(?, 0)
        """,
        (base_name, user_id)
    )

    row = cursor.fetchone()
    return row["id"] if isinstance(row, sqlite3.Row) else row[0]


@app.route("/api/auth/register", methods=["POST"])
def register_user():
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    email = normalize_email(data.get("email"))
    password = data.get("password") or ""

    if not name or not email or len(password) < 6:
        return jsonify({
            "error": "Podaj imię, email i hasło min. 6 znaków."
        }), 400

    if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
        return jsonify({"error": "Podaj poprawny email."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute(
            """
            INSERT INTO users (name, email, password_hash)
            VALUES (?, ?, ?)
            """,
            (name, email, generate_password_hash(password))
        )
        user_id = cursor.lastrowid
        seed_user_starter_words(cursor, user_id)
        token = create_auth_session(cursor, user_id)
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        return jsonify({"error": "Konto z tym adresem email już istnieje."}), 409

    cursor.execute(
        """
        SELECT id, name, email, created_at
        FROM users
        WHERE id = ?
        """,
        (user_id,)
    )

    user = serialize_user(cursor.fetchone())
    conn.close()

    return jsonify({"user": user, "token": token}), 201


@app.route("/api/auth/login", methods=["POST"])
def login_user():
    data = request.get_json() or {}
    email = normalize_email(data.get("email"))
    password = data.get("password") or ""

    if not email or not password:
        return jsonify({"error": "Podaj email i hasło."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT id, name, email, password_hash, created_at
        FROM users
        WHERE email = ?
        """,
        (email,)
    )
    user_row = cursor.fetchone()

    if not user_row or not check_password_hash(user_row["password_hash"], password):
        conn.close()
        return jsonify({"error": "Nieprawidłowy email albo hasło."}), 401

    seed_user_starter_words(cursor, user_row["id"])
    token = create_auth_session(cursor, user_row["id"])
    conn.commit()

    user = serialize_user(user_row)
    conn.close()

    return jsonify({"user": user, "token": token})


@app.route("/api/auth/me", methods=["GET"])
def get_current_user():
    user = get_auth_user()

    if not user:
        return jsonify({"user": None})

    return jsonify({"user": serialize_user(user)})


@app.route("/api/auth/logout", methods=["POST"])
def logout_user():
    header = request.headers.get("Authorization", "")

    if header.startswith("Bearer "):
        token = header.removeprefix("Bearer ").strip()

        if token:
            conn = sqlite3.connect(DB_PATH)
            cursor = conn.cursor()
            cursor.execute(
                """
                DELETE FROM auth_sessions
                WHERE token_hash = ?
                """,
                (hash_token(token),)
            )
            conn.commit()
            conn.close()

    return jsonify({"ok": True})


@app.route("/api/word-bases", methods=["GET"])
def get_word_bases():
    user_id = get_request_user_id()

    if user_id is None:
        return jsonify({"bases": GUEST_WORD_BASES})

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT id, name
        FROM word_bases
        WHERE COALESCE(user_id, 0) = COALESCE(?, 0)
        ORDER BY name COLLATE NOCASE
        """,
        (user_id,)
    )

    bases = [serialize_base(row) for row in cursor.fetchall()]
    conn.close()

    return jsonify({"bases": bases})


@app.route("/api/word-bases", methods=["POST"])
def create_word_base():
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    user_id = get_request_user_id()

    if user_id is None:
        return auth_required_response()

    if not name:
        return jsonify({"error": "Podaj nazwę bazy."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    base_id = get_or_create_base(cursor, name, user_id)
    conn.commit()

    cursor.execute(
        """
        SELECT id, name
        FROM word_bases
        WHERE id = ?
            AND COALESCE(user_id, 0) = COALESCE(?, 0)
        """,
        (base_id, user_id)
    )

    base = serialize_base(cursor.fetchone())
    conn.close()

    return jsonify({"base": base}), 201


@app.route("/api/word-bases/<int:base_id>", methods=["DELETE"])
def delete_word_base(base_id):
    user_id = get_request_user_id()

    if user_id is None:
        return auth_required_response()

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT id
        FROM word_bases
        WHERE id = ?
            AND COALESCE(user_id, 0) = COALESCE(?, 0)
        """,
        (base_id, user_id)
    )

    if cursor.fetchone() is None:
        conn.close()
        return jsonify({"error": "Nie znaleziono bazy."}), 404

    cursor.execute(
        """
        DELETE FROM words
        WHERE base_id = ?
            AND COALESCE(user_id, 0) = COALESCE(?, 0)
        """,
        (base_id, user_id)
    )
    deleted_words = cursor.rowcount

    cursor.execute(
        """
        DELETE FROM word_bases
        WHERE id = ?
            AND COALESCE(user_id, 0) = COALESCE(?, 0)
        """,
        (base_id, user_id)
    )

    conn.commit()
    conn.close()

    return jsonify({
        "deletedBaseId": base_id,
        "deletedWords": deleted_words,
    })


@app.route("/api/words", methods=["GET"])
def get_words():
    user_id = get_request_user_id()
    page = parse_positive_int(request.args.get("page"), 1)
    per_page = parse_positive_int(request.args.get("per_page"), 20, 100)
    limit = request.args.get("limit")
    search = (request.args.get("search") or "").strip()
    base_id = request.args.get("base_id")

    if user_id is None:
        return jsonify({
            "words": [],
            "pagination": {
                "page": page,
                "perPage": per_page,
                "total": 0,
                "totalPages": 1
            }
        })

    where_clauses = ["COALESCE(words.user_id, 0) = COALESCE(?, 0)"]
    params = [user_id]

    if search:
        where_clauses.append("(words.english LIKE ? OR words.polish LIKE ?)")
        params.extend([f"%{search}%", f"%{search}%"])

    if base_id:
        where_clauses.append("words.base_id = ?")
        params.append(base_id)

    where_sql = ""
    if where_clauses:
        where_sql = "WHERE " + " AND ".join(where_clauses)

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        f"SELECT COUNT(*) AS total FROM words {where_sql}",
        params
    )
    total = cursor.fetchone()["total"]

    if limit is not None:
        limit_value = parse_positive_int(limit, 10, 100)
        offset = 0
    else:
        limit_value = per_page
        offset = (page - 1) * per_page

    cursor.execute(
        f"""
        SELECT
            words.id,
            words.english,
            words.polish,
            words.base_id,
            word_bases.name AS base_name
        FROM words
        JOIN word_bases ON word_bases.id = words.base_id
        {where_sql}
        ORDER BY words.id DESC
        LIMIT ? OFFSET ?
        """,
        [*params, limit_value, offset]
    )

    words = [serialize_word(row) for row in cursor.fetchall()]
    conn.close()

    total_pages = max((total + per_page - 1) // per_page, 1)

    return jsonify({
        "words": words,
        "pagination": {
            "page": page,
            "perPage": per_page,
            "total": total,
            "totalPages": total_pages
        }
    })


@app.route("/api/words", methods=["POST"])
def create_word():
    data = request.get_json() or {}
    english = (data.get("english") or "").strip()
    polish = (data.get("polish") or "").strip()
    base_id = data.get("baseId") or data.get("base_id")
    base_name = data.get("baseName") or data.get("base_name")
    user_id = get_request_user_id()

    if user_id is None:
        return auth_required_response()

    if not english or not polish or (not base_id and not base_name):
        return jsonify({
            "error": "Podaj słowo, tłumaczenie i bazę."
        }), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    if not base_id:
        base_id = get_or_create_base(cursor, base_name, user_id)
    else:
        cursor.execute(
            """
            SELECT id
            FROM word_bases
            WHERE id = ?
                AND COALESCE(user_id, 0) = COALESCE(?, 0)
            """,
            (base_id, user_id)
        )

        if cursor.fetchone() is None:
            conn.close()
            return jsonify({"error": "Nie znaleziono bazy."}), 404

    cursor.execute(
        """
        INSERT INTO words
        (english, polish, base_id, user_id)
        VALUES (?, ?, ?, ?)
        """,
        (english, polish, base_id, user_id)
    )

    conn.commit()

    cursor.execute(
        """
        SELECT
            words.id,
            words.english,
            words.polish,
            words.base_id,
            word_bases.name AS base_name
        FROM words
        JOIN word_bases ON word_bases.id = words.base_id
        WHERE words.id = ?
            AND COALESCE(words.user_id, 0) = COALESCE(?, 0)
        """,
        (cursor.lastrowid, user_id)
    )

    word = serialize_word(cursor.fetchone())
    conn.close()

    return jsonify({"word": word}), 201


@app.route("/api/words/bulk", methods=["POST"])
def create_words_bulk():
    data = request.get_json() or {}
    words = data.get("words") or []
    base_id = data.get("baseId") or data.get("base_id")
    base_name = data.get("baseName") or data.get("base_name")
    user_id = get_request_user_id()

    if user_id is None:
        return auth_required_response()

    if not words or (not base_id and not base_name):
        return jsonify({"error": "Podaj słowa i bazę."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    if not base_id:
        base_id = get_or_create_base(cursor, base_name, user_id)
    else:
        cursor.execute(
            """
            SELECT id
            FROM word_bases
            WHERE id = ?
                AND COALESCE(user_id, 0) = COALESCE(?, 0)
            """,
            (base_id, user_id)
        )

        if cursor.fetchone() is None:
            conn.close()
            return jsonify({"error": "Nie znaleziono bazy."}), 404

    saved = []

    for word in words:
        english = (word.get("english") or "").strip()
        polish = (word.get("polish") or "").strip()

        if not english or not polish:
            continue

        cursor.execute(
            """
            INSERT INTO words
            (english, polish, base_id, user_id)
            VALUES (?, ?, ?, ?)
            """,
            (english, polish, base_id, user_id)
        )

        saved.append(cursor.lastrowid)

    conn.commit()
    conn.close()

    return jsonify({
        "saved": len(saved),
        "baseId": int(base_id)
    }), 201


@app.route("/api/words", methods=["DELETE"])
def delete_words():
    data = request.get_json() or {}
    ids = data.get("ids") or []
    user_id = get_request_user_id()

    if user_id is None:
        return auth_required_response()

    try:
        ids = [int(word_id) for word_id in ids]
    except (TypeError, ValueError):
        return jsonify({"error": "Nieprawidłowe ID słów."}), 400

    ids = list(dict.fromkeys(ids))

    if not ids:
        return jsonify({"error": "Nie wybrano słów do usunięcia."}), 400

    placeholders = ",".join("?" for _ in ids)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    cursor.execute(
        f"""
        DELETE FROM words
        WHERE id IN ({placeholders})
            AND COALESCE(user_id, 0) = COALESCE(?, 0)
        """,
        [*ids, user_id]
    )

    deleted = cursor.rowcount
    conn.commit()
    conn.close()

    return jsonify({"deleted": deleted})


@app.route("/api/words/<int:word_id>", methods=["PUT"])
def update_word(word_id):
    data = request.get_json() or {}
    english = (data.get("english") or "").strip()
    polish = (data.get("polish") or "").strip()
    base_id = data.get("baseId") or data.get("base_id")
    base_name = data.get("baseName") or data.get("base_name")
    user_id = get_request_user_id()

    if user_id is None:
        return auth_required_response()

    if not english or not polish:
        return jsonify({
            "error": "Podaj słowo po angielsku i tłumaczenie po polsku."
        }), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    if not base_id and base_name:
        base_id = get_or_create_base(cursor, base_name, user_id)

    if base_id:
        cursor.execute(
            """
            SELECT id
            FROM word_bases
            WHERE id = ?
                AND COALESCE(user_id, 0) = COALESCE(?, 0)
            """,
            (base_id, user_id)
        )

        if cursor.fetchone() is None:
            conn.close()
            return jsonify({"error": "Nie znaleziono bazy."}), 404

    if base_id:
        cursor.execute(
            """
            UPDATE words
            SET english = ?, polish = ?, base_id = ?
            WHERE id = ?
                AND COALESCE(user_id, 0) = COALESCE(?, 0)
            """,
            (english, polish, base_id, word_id, user_id)
        )
    else:
        cursor.execute(
            """
            UPDATE words
            SET english = ?, polish = ?
            WHERE id = ?
                AND COALESCE(user_id, 0) = COALESCE(?, 0)
            """,
            (english, polish, word_id, user_id)
        )

    if cursor.rowcount == 0:
        conn.close()
        return jsonify({"error": "Nie znaleziono słowa."}), 404

    conn.commit()

    cursor.execute(
        """
        SELECT
            words.id,
            words.english,
            words.polish,
            words.base_id,
            word_bases.name AS base_name
        FROM words
        JOIN word_bases ON word_bases.id = words.base_id
        WHERE words.id = ?
            AND COALESCE(words.user_id, 0) = COALESCE(?, 0)
        """,
        (word_id, user_id)
    )

    word = serialize_word(cursor.fetchone())
    conn.close()

    return jsonify({"word": word})


@app.route("/api/study-sessions", methods=["POST"])
def create_study_session():
    data = request.get_json() or {}
    user_id = get_request_user_id()

    if user_id is None:
        return auth_required_response()

    base_id = data.get("baseId") or data.get("base_id")
    words_count = parse_positive_int(data.get("wordsCount") or data.get("words_count"), 1)
    stages_count = parse_positive_int(data.get("stagesCount") or data.get("stages_count"), 1)

    conn = get_db_connection()
    cursor = conn.cursor()

    if base_id:
        cursor.execute(
            """
            SELECT id
            FROM word_bases
            WHERE id = ?
                AND COALESCE(user_id, 0) = COALESCE(?, 0)
            """,
            (base_id, user_id)
        )

        if cursor.fetchone() is None:
            conn.close()
            return jsonify({"error": "Nie znaleziono bazy."}), 404

        base_id = int(base_id)
    else:
        base_id = None

    cursor.execute(
        """
        INSERT INTO study_sessions
        (user_id, base_id, words_count, stages_count)
        VALUES (?, ?, ?, ?)
        """,
        (user_id, base_id, words_count, stages_count)
    )
    session_id = cursor.lastrowid
    conn.commit()

    cursor.execute(
        """
        SELECT
            study_sessions.id,
            study_sessions.base_id,
            COALESCE(word_bases.name, 'Wszystkie') AS base_name,
            study_sessions.words_count,
            study_sessions.stages_count,
            study_sessions.completed_at
        FROM study_sessions
        LEFT JOIN word_bases ON word_bases.id = study_sessions.base_id
        WHERE study_sessions.id = ?
            AND study_sessions.user_id = ?
        """,
        (session_id, user_id)
    )

    session = serialize_study_session(cursor.fetchone())
    conn.close()

    return jsonify({"session": session}), 201


@app.route("/api/study-sessions/stats", methods=["GET"])
def get_study_session_stats():
    user_id = get_request_user_id()

    if user_id is None:
        return auth_required_response()

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT
            study_cycle_achievements.id,
            study_cycle_achievements.base_id,
            COALESCE(word_bases.name, 'Wszystkie') AS base_name,
            study_cycle_achievements.cycle_number,
            study_cycle_achievements.words_count,
            study_cycle_achievements.new_words_count,
            study_cycle_achievements.review_words_count,
            study_cycle_achievements.completed_at
        FROM study_cycle_achievements
        LEFT JOIN word_bases ON word_bases.id = study_cycle_achievements.base_id
        WHERE study_cycle_achievements.user_id = ?
        ORDER BY study_cycle_achievements.completed_at DESC
        LIMIT 12
        """,
        (user_id,)
    )
    recent_cycles = [serialize_study_cycle(row) for row in cursor.fetchall()]

    cursor.execute(
        """
        SELECT *
        FROM (
            SELECT
                DATE(completed_at) AS day,
                COUNT(*) AS cycles,
                SUM(new_words_count) AS new_words,
                SUM(review_words_count) AS reviews
            FROM study_cycle_achievements
            WHERE user_id = ?
            GROUP BY DATE(completed_at)
            ORDER BY day DESC
            LIMIT 180
        )
        ORDER BY day ASC
        """,
        (user_id,)
    )
    daily_progress = [
        {
            "day": row["day"],
            "cycles": row["cycles"],
            "newWords": row["new_words"] or 0,
            "reviews": row["reviews"] or 0,
        }
        for row in cursor.fetchall()
    ]

    cursor.execute(
        """
        SELECT
            COUNT(*) AS total_cycles,
            COALESCE(SUM(new_words_count), 0) AS total_new_words,
            COALESCE(SUM(review_words_count), 0) AS total_reviews,
            MAX(completed_at) AS last_completed_at
        FROM study_cycle_achievements
        WHERE user_id = ?
        """,
        (user_id,)
    )
    totals_row = cursor.fetchone()
    conn.close()

    return jsonify({
        "summary": {
            "totalCycles": totals_row["total_cycles"],
            "totalNewWords": totals_row["total_new_words"],
            "totalReviews": totals_row["total_reviews"],
            "lastCompletedAt": totals_row["last_completed_at"],
        },
        "dailyProgress": daily_progress,
        "recentCycles": recent_cycles,
    })


@app.route("/api/study-cycles", methods=["POST"])
def create_study_cycle():
    data = request.get_json() or {}
    user_id = get_request_user_id()

    if user_id is None:
        return auth_required_response()

    base_id = data.get("baseId") or data.get("base_id")
    cycle_number = parse_positive_int(data.get("cycleNumber") or data.get("cycle_number"), 1)
    word_ids = data.get("wordIds") or data.get("word_ids") or []

    try:
        word_ids = [int(word_id) for word_id in word_ids]
    except (TypeError, ValueError):
        return jsonify({"error": "Nieprawidłowe ID słów."}), 400

    word_ids = list(dict.fromkeys(word_ids))

    if not word_ids:
        return jsonify({"error": "Brak słów cyklu."}), 400

    conn = get_db_connection()
    cursor = conn.cursor()

    if base_id:
        cursor.execute(
            """
            SELECT id
            FROM word_bases
            WHERE id = ?
                AND COALESCE(user_id, 0) = COALESCE(?, 0)
            """,
            (base_id, user_id)
        )

        if cursor.fetchone() is None:
            conn.close()
            return jsonify({"error": "Nie znaleziono bazy."}), 404

        base_id = int(base_id)
    else:
        base_id = None

    placeholders = ",".join("?" for _ in word_ids)
    cursor.execute(
        f"""
        SELECT id
        FROM words
        WHERE id IN ({placeholders})
            AND COALESCE(user_id, 0) = COALESCE(?, 0)
        """,
        [*word_ids, user_id]
    )
    owned_word_ids = {row["id"] for row in cursor.fetchall()}

    if len(owned_word_ids) != len(word_ids):
        conn.close()
        return jsonify({"error": "Nie znaleziono części słów cyklu."}), 404

    cursor.execute(
        f"""
        SELECT word_id
        FROM learned_words
        WHERE user_id = ?
            AND word_id IN ({placeholders})
        """,
        [user_id, *word_ids]
    )
    already_learned_word_ids = {row["word_id"] for row in cursor.fetchall()}
    new_word_ids = [word_id for word_id in word_ids if word_id not in already_learned_word_ids]
    review_words_count = len(word_ids) - len(new_word_ids)

    for word_id in new_word_ids:
        cursor.execute(
            """
            INSERT OR IGNORE INTO learned_words (user_id, word_id)
            VALUES (?, ?)
            """,
            (user_id, word_id)
        )

    cursor.execute(
        """
        INSERT INTO study_cycle_achievements
        (user_id, base_id, cycle_number, words_count, new_words_count, review_words_count)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (
            user_id,
            base_id,
            cycle_number,
            len(word_ids),
            len(new_word_ids),
            review_words_count,
        )
    )
    cycle_id = cursor.lastrowid
    conn.commit()

    cursor.execute(
        """
        SELECT
            study_cycle_achievements.id,
            study_cycle_achievements.base_id,
            COALESCE(word_bases.name, 'Wszystkie') AS base_name,
            study_cycle_achievements.cycle_number,
            study_cycle_achievements.words_count,
            study_cycle_achievements.new_words_count,
            study_cycle_achievements.review_words_count,
            study_cycle_achievements.completed_at
        FROM study_cycle_achievements
        LEFT JOIN word_bases ON word_bases.id = study_cycle_achievements.base_id
        WHERE study_cycle_achievements.id = ?
            AND study_cycle_achievements.user_id = ?
        """,
        (cycle_id, user_id)
    )

    cycle = serialize_study_cycle(cursor.fetchone())
    conn.close()

    return jsonify({"cycle": cycle}), 201


@app.route("/api/study-cycles/status", methods=["GET"])
def get_study_cycle_status():
    user_id = get_request_user_id()

    if user_id is None:
        return auth_required_response()

    base_id = request.args.get("base_id")
    conn = get_db_connection()
    cursor = conn.cursor()

    if base_id:
        cursor.execute(
            """
            SELECT id
            FROM word_bases
            WHERE id = ?
                AND COALESCE(user_id, 0) = COALESCE(?, 0)
            """,
            (base_id, user_id)
        )

        if cursor.fetchone() is None:
            conn.close()
            return jsonify({"error": "Nie znaleziono bazy."}), 404

        cursor.execute(
            """
            SELECT
                cycle_number,
                COUNT(*) AS completed_count,
                MAX(completed_at) AS last_completed_at
            FROM study_cycle_achievements
            WHERE user_id = ?
                AND base_id = ?
            GROUP BY cycle_number
            ORDER BY cycle_number ASC
            """,
            (user_id, int(base_id))
        )
    else:
        cursor.execute(
            """
            SELECT
                cycle_number,
                COUNT(*) AS completed_count,
                MAX(completed_at) AS last_completed_at
            FROM study_cycle_achievements
            WHERE user_id = ?
                AND base_id IS NULL
            GROUP BY cycle_number
            ORDER BY cycle_number ASC
            """,
            (user_id,)
        )

    cycles = [
        {
            "cycleNumber": row["cycle_number"],
            "completedCount": row["completed_count"],
            "lastCompletedAt": row["last_completed_at"],
        }
        for row in cursor.fetchall()
    ]
    conn.close()

    return jsonify({"cycles": cycles})


@app.route("/api/study-sessions/legacy-stats", methods=["GET"])
def get_legacy_study_session_stats():
    user_id = get_request_user_id()

    if user_id is None:
        return auth_required_response()

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        SELECT
            study_sessions.id,
            study_sessions.base_id,
            COALESCE(word_bases.name, 'Wszystkie') AS base_name,
            study_sessions.words_count,
            study_sessions.stages_count,
            study_sessions.completed_at
        FROM study_sessions
        LEFT JOIN word_bases ON word_bases.id = study_sessions.base_id
        WHERE study_sessions.user_id = ?
        ORDER BY study_sessions.completed_at DESC
        LIMIT 12
        """,
        (user_id,)
    )
    recent_sessions = [serialize_study_session(row) for row in cursor.fetchall()]

    cursor.execute(
        """
        SELECT *
        FROM (
            SELECT
                DATE(completed_at) AS day,
                COUNT(*) AS sessions,
                SUM(words_count) AS words,
                SUM(stages_count) AS stages
            FROM study_sessions
            WHERE user_id = ?
            GROUP BY DATE(completed_at)
            ORDER BY day DESC
            LIMIT 30
        )
        ORDER BY day ASC
        """,
        (user_id,)
    )
    daily_progress = [
        {
            "day": row["day"],
            "sessions": row["sessions"],
            "words": row["words"] or 0,
            "stages": row["stages"] or 0,
        }
        for row in cursor.fetchall()
    ]

    cursor.execute(
        """
        SELECT
            COALESCE(word_bases.name, 'Wszystkie') AS base_name,
            COUNT(*) AS sessions,
            SUM(study_sessions.words_count) AS words
        FROM study_sessions
        LEFT JOIN word_bases ON word_bases.id = study_sessions.base_id
        WHERE study_sessions.user_id = ?
        GROUP BY COALESCE(study_sessions.base_id, 0), base_name
        ORDER BY sessions DESC, words DESC
        LIMIT 8
        """,
        (user_id,)
    )
    by_base = [
        {
            "baseName": row["base_name"],
            "sessions": row["sessions"],
            "words": row["words"] or 0,
        }
        for row in cursor.fetchall()
    ]

    cursor.execute(
        """
        SELECT
            COUNT(*) AS total_sessions,
            COALESCE(SUM(words_count), 0) AS total_words,
            COALESCE(SUM(stages_count), 0) AS total_stages,
            MAX(completed_at) AS last_completed_at
        FROM study_sessions
        WHERE user_id = ?
        """,
        (user_id,)
    )
    totals_row = cursor.fetchone()
    conn.close()

    return jsonify({
        "summary": {
            "totalSessions": totals_row["total_sessions"],
            "totalWords": totals_row["total_words"],
            "totalStages": totals_row["total_stages"],
            "lastCompletedAt": totals_row["last_completed_at"],
        },
        "dailyProgress": daily_progress,
        "byBase": by_base,
        "recentSessions": recent_sessions,
    })


@app.route("/api/translate-word", methods=["POST"])
def translate_word():
    data = request.get_json(silent=True) or {}
    english = (data.get("english") or "").strip()
    sentence = re.sub(r"\s+", " ", (data.get("sentence") or "")).strip()
    sentence = sentence[:1200]

    if not english:
        return jsonify({"error": "Podaj słowo albo zwrot po angielsku."}), 400

    try:
        response = get_openai_client().chat.completions.create(
            model="gpt-4.1-mini",
            messages=[
                {
                    "role": "system",
                    "content": """
Jesteś nauczycielem angielskiego dla polskiego użytkownika.
Przetłumacz angielskie słowo albo zwrot na polski.

Zasady:
- jeśli podano zdanie, tłumacz zaznaczone słowo dokładnie w znaczeniu, jakie ma w tym zdaniu
- jeśli wejście jest zwrotem, idiomem, kolokacją albo phrasal verb, tłumacz cały zwrot jako całość, a nie słowo po słowie
- zachowaj sens edukacyjny do fiszek; podawaj naturalny polski odpowiednik w formie słownikowej
- dla czasowników używaj polskiego bezokolicznika, np. "cierpieć", "opiekować się", "poruszać się"
- dla rzeczowników używaj podstawowej formy, np. "gardło", "historia"
- jeśli forma w zdaniu jest imiesłowem albo przymiotnikiem, możesz oddać ją naturalną polską formą, np. "zmęczony", "ukryty", "wzmocniony"
- zachowuj placeholdery typu "sb", "sth", "something", "somebody" jako polskie "kogoś", "coś", "kimś", "czymś" zależnie od zwrotu
- nie dopisuj przykładów, objaśnień ani alternatyw, chyba że są konieczne; wtedy rozdziel je średnikiem
- przykłady poprawnego podejścia:
  "suffer from sth" -> "cierpieć na coś"
  "look after sb" -> "opiekować się kimś"
  "take care of sb/sth" -> "opiekować się kimś/czymś"
  "be afraid of sth" -> "bać się czegoś"

Zwróć wyłącznie JSON bez markdown i komentarzy.
Format:
{"polish":"tłumaczenie"}
""",
                },
                {
                    "role": "user",
                    "content": json.dumps(
                        {
                            "selectedWord": english,
                            "sentence": sentence,
                        },
                        ensure_ascii=False,
                    ),
                },
            ],
        )

        content = response.choices[0].message.content
        parsed = json.loads(content)
        polish = (parsed.get("polish") or "").strip()

        if not polish:
            return jsonify({"error": "Nie udało się przetłumaczyć słowa."}), 502

        return jsonify({"polish": polish})
    except Exception as error:
        print("ERROR /api/translate-word:", error)
        return jsonify({"error": "Nie udało się przetłumaczyć słowa."}), 500


def load_image(path):
    return cv2.imread(path)


def resize_image(image, width, height):
    return cv2.resize(image, (width, height))


def resize_image_by_extra_pixels(image, extra_pixels=100):
    height, width = image.shape[:2]

    return resize_image(
        image,
        width + extra_pixels,
        height + extra_pixels
    )


def rotate_image(image, angle):
    try:
        angle = int(angle) % 360
    except (TypeError, ValueError):
        angle = 0

    if angle == 90:
        return cv2.rotate(image, cv2.ROTATE_90_CLOCKWISE)

    if angle == 180:
        return cv2.rotate(image, cv2.ROTATE_180)

    if angle == 270:
        return cv2.rotate(image, cv2.ROTATE_90_COUNTERCLOCKWISE)

    return image


def extract_word_pairs_with_llm(ocr_items):

    text = "\n".join(
        item["text"]
        for item in ocr_items
    )

    response = get_openai_client().chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
{
    "role": "system",
    "content": """
Jesteś korektorem OCR i nauczycielem angielskiego.

Z tekstu OCR wyciągnij pary angielski-polski.

Zasady:
- poprawiaj błędy OCR
- poprawiaj polskie znaki: ł, ą, ć, ę, ń, ó, ś, ź, ż
- poprawiaj polskie końcówki
- zachowuj angielskie zwroty wielowyrazowe jako jedną fiszkę, np. "suffer from sth", "look after sb", "take care of sth"
- nie rozbijaj phrasal verbs, idiomów, kolokacji ani wyrażeń z przyimkiem na pojedyncze słowa
- tłumacz cały zwrot jako całość, a nie ostatnie słowo ani dosłowne części składowe
- zachowuj placeholdery typu "sb", "sth", "something", "somebody" jako polskie "kogoś", "coś", "kimś", "czymś" zależnie od zwrotu
- polskie czasowniki zapisuj jako bezokoliczniki, np. "boleć", "kaszleć", "zemdleć"
- rzeczowniki zapisuj w podstawowej formie, np. "głowa", "ręka", "żołądek"
- nie zostawiaj form typu "bolet", "kaszlec", "miec"
- "hurt" tłumacz jako "boleć"
- "cough" tłumacz jako "kaszleć; kaszel" tylko jeśli tak wynika z tekstu
- przykłady zwrotów:
  "suffer from sth" -> "cierpieć na coś"
  "look after sb" -> "opiekować się kimś"
  "be allergic to sth" -> "być uczulonym na coś"
  "have a sore throat" -> "mieć ból gardła"
- zwracaj wyłącznie JSON
- bez markdown
- bez komentarzy

Format:
[
  {
    "english": "hurt",
    "polish": "boleć"
  }
]
"""
},
            {
                "role":"user",
                "content":text
            }
        ]
    )

    content = response.choices[0].message.content

    print("LLM RESPONSE:")
    print(content)

    try:
        return json.loads(content)

    except Exception as e:
        print("JSON ERROR:", e)
        return []

@app.route("/api/extract-words", methods=["POST"])
def extract_words():
    try:
        global LAST_BITMAP
        global LAST_CLEAN_IMAGE

        if LAST_BITMAP is None:
            return {"error": "Brak obrazu"}, 400

        ocr_items = collect_ocr_items_from_images([
            LAST_BITMAP,
            LAST_CLEAN_IMAGE,
        ])

        words = extract_word_pairs_with_llm(ocr_items)

        return {
            "words": words
        }

    except Exception as error:
        print("ERROR /api/extract-words:", error)
        traceback.print_exc()
        return {"error": str(error)}, 500

def remove_shadows(image):
    """
    Usuwa cienie i wyrównuje jasność
    """

    gray = cv2.cvtColor(
        image,
        cv2.COLOR_BGR2GRAY
    )

    # rozmyte tło (duże struktury = cienie)
    background = cv2.GaussianBlur(
        gray,
        (101,101),
        0
    )

    # odejmujemy tło
    normalized = cv2.divide(
        gray,
        background,
        scale=255
    )

    return normalized


def convert_to_bitmap(image):
    bw = cv2.adaptiveThreshold(
        image,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        45,
        17
    )

    return bw


def find_page_contour(image):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    mask = cv2.inRange(gray, 120, 255)

    kernel = np.ones((15, 15), np.uint8)

    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel, iterations=4)

    contours, _ = cv2.findContours(
        mask,
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE
    )

    image_area = image.shape[0] * image.shape[1]

    candidates = []

    for contour in contours:
        area = cv2.contourArea(contour)

        if area < image_area * 0.25:
            continue

        x, y, w, h = cv2.boundingRect(contour)

        ratio = h / w

        if 1.1 < ratio < 2.2:
            candidates.append(contour)

    if not candidates:
        return None

    contour = max(candidates, key=cv2.contourArea)

    perimeter = cv2.arcLength(contour, True)

    approx = cv2.approxPolyDP(
        contour,
        0.02 * perimeter,
        True
    )

    if len(approx) == 4:
        return approx.reshape(4, 2)

    x, y, w, h = cv2.boundingRect(contour)

    return np.array([
        [x, y],
        [x + w, y],
        [x + w, y + h],
        [x, y + h]
    ], dtype="float32")

def order_points(points):
    points = np.array(points, dtype="float32")

    rect = np.zeros((4, 2), dtype="float32")

    s = points.sum(axis=1)
    diff = np.diff(points, axis=1)

    rect[0] = points[np.argmin(s)]      # lewy górny
    rect[2] = points[np.argmax(s)]      # prawy dolny
    rect[1] = points[np.argmin(diff)]   # prawy górny
    rect[3] = points[np.argmax(diff)]   # lewy dolny

    return rect

def crop_page_perspective(image):
    points = find_page_contour(image)

    if points is None:
        print("Nie znaleziono strony — zwracam oryginał")
        return image

    rect = order_points(points)

    top_left, top_right, bottom_right, bottom_left = rect

    width_a = np.linalg.norm(bottom_right - bottom_left)
    width_b = np.linalg.norm(top_right - top_left)
    max_width = int(max(width_a, width_b))

    height_a = np.linalg.norm(top_right - bottom_right)
    height_b = np.linalg.norm(top_left - bottom_left)
    max_height = int(max(height_a, height_b))

    if max_width < 300 or max_height < 300:
        print("Wykryty kontur jest za mały — zwracam oryginał")
        return image

    if max_height / max_width > 3 or max_width / max_height > 3:
        print("Wykryty kontur ma zły stosunek boków — zwracam oryginał")
        return image

    destination = np.array([
        [0, 0],
        [max_width - 1, 0],
        [max_width - 1, max_height - 1],
        [0, max_height - 1]
    ], dtype="float32")

    matrix = cv2.getPerspectiveTransform(rect, destination)

    return cv2.warpPerspective(image, matrix, (max_width, max_height))

def trim_white_page(image, margin=10):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # szukamy nie-białych pikseli, czyli zawartości strony / krawędzi
    _, thresh = cv2.threshold(gray, 245, 255, cv2.THRESH_BINARY_INV)

    coords = cv2.findNonZero(thresh)

    if coords is None:
        return image

    x, y, w, h = cv2.boundingRect(coords)

    x = max(x - margin, 0)
    y = max(y - margin, 0)
    w = min(w + 2 * margin, image.shape[1] - x)
    h = min(h + 2 * margin, image.shape[0] - y)

    return image[y:y+h, x:x+w]

def main():
    image = load_image("images/book.jpeg")

    page = crop_page_perspective(image)

    page = trim_white_page(page, margin=15)

    page = resize_image(page, 1400, 2000)

    clean = remove_shadows(page)

    bitmap = convert_to_bitmap(clean)

    cv2.imwrite("images/book_scan.png", bitmap)


@app.route("/api/scan", methods=["POST"])
def process_image():
    global LAST_BITMAP
    global LAST_FULL_BITMAP
    global LAST_CLEAN_IMAGE
    global LAST_FULL_CLEAN_IMAGE

    file = request.files.get("image")

    if file is None:
        return {"error": "Brak pliku image"}, 400

    file_bytes = np.frombuffer(file.read(), np.uint8)
    image = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)

    if image is None:
        return {"error": "Nie można wczytać obrazu"}, 400

    rotation = request.form.get("rotation", 0)
    image = rotate_image(image, rotation)

    page = crop_page_perspective(image)
    page = trim_white_page(page, margin=15)
    page = resize_image_by_extra_pixels(page, extra_pixels=100)
    clean = remove_shadows(page)
    bitmap = convert_to_bitmap(clean)

    LAST_BITMAP = bitmap.copy()
    LAST_FULL_BITMAP = bitmap.copy()
    LAST_CLEAN_IMAGE = clean.copy()
    LAST_FULL_CLEAN_IMAGE = clean.copy()

    output_path = tempfile.NamedTemporaryFile(suffix=".png", delete=False).name
    cv2.imwrite(output_path, bitmap)

    return send_file(output_path, mimetype="image/png")


@app.route("/api/crop", methods=["POST"])
def crop_selected_area():
    global LAST_BITMAP
    global LAST_FULL_BITMAP
    global LAST_CLEAN_IMAGE
    global LAST_FULL_CLEAN_IMAGE

    if LAST_FULL_BITMAP is None:
        return jsonify({"error": "Brak obrazu do przycięcia"}), 400

    data = request.get_json()
    points = data.get("points")

    if not points or len(points) != 4:
        return jsonify({"error": "Musisz przesłać dokładnie 4 punkty"}), 400

    points = np.array(
        [[p["x"], p["y"]] for p in points],
        dtype="float32"
    )

    rect = order_points(points)

    top_left, top_right, bottom_right, bottom_left = rect

    width_a = np.linalg.norm(bottom_right - bottom_left)
    width_b = np.linalg.norm(top_right - top_left)
    max_width = int(max(width_a, width_b))

    height_a = np.linalg.norm(top_right - bottom_right)
    height_b = np.linalg.norm(top_left - bottom_left)
    max_height = int(max(height_a, height_b))

    destination = np.array([
        [0, 0],
        [max_width - 1, 0],
        [max_width - 1, max_height - 1],
        [0, max_height - 1]
    ], dtype="float32")

    matrix = cv2.getPerspectiveTransform(rect, destination)

    cropped = cv2.warpPerspective(
        LAST_FULL_BITMAP,
        matrix,
        (max_width, max_height)
    )
    clean_cropped = None

    if LAST_FULL_CLEAN_IMAGE is not None:
        clean_cropped = cv2.warpPerspective(
            LAST_FULL_CLEAN_IMAGE,
            matrix,
            (max_width, max_height)
        )

    LAST_BITMAP = cropped.copy()
    LAST_CLEAN_IMAGE = clean_cropped.copy() if clean_cropped is not None else None

    cv2.imwrite(
    os.path.join(OUTPUT_DIR, "last_cropped_bitmap.png"),
    LAST_BITMAP
)

    output_path = tempfile.NamedTemporaryFile(suffix=".png", delete=False).name
    cv2.imwrite(output_path, cropped)

    return send_file(output_path, mimetype="image/png")


@app.route("/api/extract", methods=["POST"])
def extract_text():

    global LAST_BITMAP
    global LAST_CLEAN_IMAGE

    if LAST_BITMAP is None:
        return {"error":"Brak obrazu"}, 400

    text_blocks = collect_ocr_items_from_images([
        LAST_BITMAP,
        LAST_CLEAN_IMAGE,
    ])

    return {
        "results": text_blocks
    }

if __name__ == "__main__":
    app.run(debug=True, port=5000)
