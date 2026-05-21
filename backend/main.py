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
    """
    Adaptacyjne progowanie
    """

    bw = cv2.adaptiveThreshold(
        image,
        255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31,
        15
    )

    return bw


def main():

    image = load_image("images/book.jpeg")

    image = resize_image(
        image,
        1200,
        2000
    )

    # image = rotate_image(
    #     image,
    #     90
    # )

    image = remove_shadows(
        image
    )

    image = convert_to_bitmap(
        image
    )

    cv2.imwrite(
        "images/book_clean.png",
        image
    )


if __name__ == "__main__":
    main()