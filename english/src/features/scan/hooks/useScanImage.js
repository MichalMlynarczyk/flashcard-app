import { useRef, useState } from "react";
import { cropImage, extractWords, scanImage } from "../services/scanApi";
import {
  createWordsBulk,
  fetchWordBases,
} from "../../words/services/wordsApi";

export default function useScanImage() {
  const cameraInputRef = useRef(null);
  const libraryInputRef = useRef(null);
  const imageRef = useRef(null);

  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [processedUrl, setProcessedUrl] = useState(null);
  const [fullProcessedUrl, setFullProcessedUrl] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [points, setPoints] = useState([]);
  const [isCropped, setIsCropped] = useState(false);
  const [rotationDegrees, setRotationDegrees] = useState(0);
  const [extractedWords, setExtractedWords] = useState([]);
  const [wordBases, setWordBases] = useState([]);
  const [selectedBaseId, setSelectedBaseId] = useState("");
  const [newBaseName, setNewBaseName] = useState("");
  const [isExtractingWords, setIsExtractingWords] = useState(false);
  const [isSavingExtractedWords, setIsSavingExtractedWords] = useState(false);
  const [scanError, setScanError] = useState("");
  const [failedAction, setFailedAction] = useState(null);

  function handleFile(file) {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Wybierz plik graficzny.");
      return;
    }

    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    setProcessedUrl(null);
    setFullProcessedUrl(null);
    setPoints([]);
    setIsCropped(false);
    setRotationDegrees(0);
    setExtractedWords([]);
    setScanError("");
    setFailedAction(null);
  }

  function handleInputChange(event) {
    handleFile(event.target.files?.[0]);
  }

  function handleDrop(event) {
    event.preventDefault();
    setIsDragging(false);
    handleFile(event.dataTransfer.files?.[0]);
  }

  function handleDragOver(event) {
    event.preventDefault();
    setIsDragging(true);
  }

  function removeImage() {
    setImageFile(null);
    setPreviewUrl(null);
    setProcessedUrl(null);
    setFullProcessedUrl(null);
    setPoints([]);
    setIsCropped(false);
    setRotationDegrees(0);
    setExtractedWords([]);
    setSelectedBaseId("");
    setNewBaseName("");
    setScanError("");
    setFailedAction(null);

    [cameraInputRef, libraryInputRef].forEach((inputRef) => {
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    });
  }

  async function sendImageToServer() {
    if (!imageFile) return;

    setIsProcessing(true);
    setPoints([]);
    setIsCropped(false);
    setScanError("");
    setFailedAction(null);

    try {
      const blob = await scanImage(imageFile, rotationDegrees);
      const url = URL.createObjectURL(blob);

      setPreviewUrl(null);
      setProcessedUrl(url);
      setFullProcessedUrl(url);
      setPoints([]);
    } catch (error) {
      console.error(error);
      setScanError(
        "Nie udało się przetworzyć zdjęcia. Obraz został zachowany, możesz szybko ponowić skan."
      );
      setFailedAction("scan");
    } finally {
      setIsProcessing(false);
    }
  }

  function getNaturalPointFromEvent(event) {
    if (!imageRef.current) return null;

    const rect = imageRef.current.getBoundingClientRect();
    const displayedX = event.clientX - rect.left;
    const displayedY = event.clientY - rect.top;
    const scaleX = imageRef.current.naturalWidth / rect.width;
    const scaleY = imageRef.current.naturalHeight / rect.height;

    return {
      x: Math.min(
        Math.max(displayedX * scaleX, 0),
        imageRef.current.naturalWidth
      ),
      y: Math.min(
        Math.max(displayedY * scaleY, 0),
        imageRef.current.naturalHeight
      ),
    };
  }

  function handleImageClick(event) {
    if (points.length >= 4) return;

    const point = getNaturalPointFromEvent(event);

    if (!point) return;

    setPoints((previousPoints) => [
      ...previousPoints,
      point,
    ]);
  }

  function movePoint(pointIndex, event) {
    const nextPoint = getNaturalPointFromEvent(event);

    if (!nextPoint) return;

    setPoints((previousPoints) =>
      previousPoints.map((point, index) =>
        index === pointIndex ? nextPoint : point
      )
    );
  }

  async function cropOnServer() {
    if (points.length !== 4) {
      alert("Zaznacz dokładnie 4 punkty.");
      return;
    }

    try {
      setScanError("");
      setFailedAction(null);

      const blob = await cropImage(points);
      const url = URL.createObjectURL(blob);

      setProcessedUrl(url);
      setPoints([]);
      setIsCropped(true);
      setExtractedWords([]);
    } catch (error) {
      console.error(error);
      setScanError(
        "Nie udało się przyciąć obrazu. Zaznaczone punkty zostały zachowane."
      );
      setFailedAction("crop");
    }
  }

  async function extractWordsFromScan() {
    setIsExtractingWords(true);
    setScanError("");
    setFailedAction(null);

    try {
      const data = await extractWords();
      const basesData = await fetchWordBases();

      setExtractedWords(data.words ?? []);
      setWordBases(basesData.bases ?? []);
      setSelectedBaseId(basesData.bases?.[0]?.id?.toString() ?? "");
    } catch (error) {
      console.error(error);
      setScanError(
        "Nie udało się wyodrębnić słów. Przetworzony skan został zachowany."
      );
      setFailedAction("extract");
    } finally {
      setIsExtractingWords(false);
    }
  }

  async function saveExtractedWords() {
    if (extractedWords.length === 0) return;

    if (!selectedBaseId && !newBaseName.trim()) {
      alert("Wybierz bazę albo wpisz nazwę nowej.");
      return;
    }

    setIsSavingExtractedWords(true);

    try {
      await createWordsBulk({
        baseId: selectedBaseId || undefined,
        baseName: newBaseName.trim() || undefined,
        words: extractedWords,
      });

      setProcessedUrl(fullProcessedUrl);
      setExtractedWords([]);
      setPoints([]);
      setNewBaseName("");
      setSelectedBaseId("");
      setIsCropped(false);
    } catch (error) {
      console.error(error);
      alert("Nie udało się zapisać słów.");
    } finally {
      setIsSavingExtractedWords(false);
    }
  }

  function retryFailedAction() {
    if (failedAction === "scan") {
      sendImageToServer();
      return;
    }

    if (failedAction === "crop") {
      cropOnServer();
      return;
    }

    if (failedAction === "extract") {
      extractWordsFromScan();
    }
  }

  return {
    cameraInputRef,
    libraryInputRef,
    imageRef,
    imageFile,
    previewUrl,
    processedUrl,
    isDragging,
    isProcessing,
    points,
    isCropped,
    rotationDegrees,
    extractedWords,
    wordBases,
    selectedBaseId,
    newBaseName,
    isExtractingWords,
    isSavingExtractedWords,
    failedAction,
    scanError,
    clearPoints: () => setPoints([]),
    handleDragLeave: () => setIsDragging(false),
    handleDragOver,
    handleDrop,
    handleImageClick,
    handleInputChange,
    movePoint,
    openCameraPicker: () => cameraInputRef.current?.click(),
    openLibraryPicker: () => libraryInputRef.current?.click(),
    rotateLeft: () =>
      setRotationDegrees((currentRotation) => (currentRotation + 270) % 360),
    rotateRight: () =>
      setRotationDegrees((currentRotation) => (currentRotation + 90) % 360),
    removeImage,
    sendImageToServer,
    cropOnServer,
    extractWordsFromScan,
    saveExtractedWords,
    retryFailedAction,
    setSelectedBaseId,
    setNewBaseName,
  };
}
