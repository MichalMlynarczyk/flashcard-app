import cv2
import numpy as np


def load_image(path):
    return cv2.imread(path)

def resize_image(image, width, height):
    return cv2.resize(image, (width, height))

def rotate_image(image, angle):
    h, w = image.shape[:2]

    center = (w // 2, h // 2)

    matrix = cv2.getRotationMatrix2D(
        center,
        angle,
        1.0
    )

    return cv2.warpAffine(
        image,
        matrix,
        (w, h)
    )

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

    cv2.imwrite("images/book_cropped.png", page)
    cv2.imwrite("images/book_scan.png", bitmap)

if __name__ == "__main__":
    main()