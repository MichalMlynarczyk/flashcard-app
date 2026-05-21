import useScanImage from "../hooks/useScanImage";
import EmptyScanState from "./EmptyScanState";
import ProcessedImageView from "./ProcessedImageView";
import PreviewImageView from "./PreviewImageView";

export default function ScanSection() {
  const {
    inputRef,
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
    clearPoints,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    handleImageClick,
    handleInputChange,
    movePoint,
    openFilePicker,
    rotateLeft,
    rotateRight,
    removeImage,
    sendImageToServer,
    cropOnServer,
    extractWordsFromScan,
    saveExtractedWords,
    retryFailedAction,
    setSelectedBaseId,
    setNewBaseName,
  } = useScanImage();

  const hasImage = previewUrl || processedUrl;

  return (
    <section
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`rounded-[32px] border-2 border-dashed px-8 py-16 transition ${
        isDragging
          ? "border-violet-500 bg-violet-500/10"
          : "border-white/10 bg-slate-950/70"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleInputChange}
        className="hidden"
      />

      {!hasImage && <EmptyScanState onSelectImage={openFilePicker} />}

      {previewUrl && (
        <PreviewImageView
          imageFile={imageFile}
          isProcessing={isProcessing}
          previewUrl={previewUrl}
          rotationDegrees={rotationDegrees}
          scanError={failedAction === "scan" ? scanError : ""}
          onChangeImage={openFilePicker}
          onProcessImage={sendImageToServer}
          onRemoveImage={removeImage}
          onRetry={retryFailedAction}
          onRotateLeft={rotateLeft}
          onRotateRight={rotateRight}
        />
      )}

      {processedUrl && (
        <ProcessedImageView
          imageRef={imageRef}
          isCropped={isCropped}
          isExtractingWords={isExtractingWords}
          isSavingExtractedWords={isSavingExtractedWords}
          extractedWords={extractedWords}
          wordBases={wordBases}
          selectedBaseId={selectedBaseId}
          newBaseName={newBaseName}
          points={points}
          processedUrl={processedUrl}
          scanError={failedAction !== "scan" ? scanError : ""}
          onClearPoints={clearPoints}
          onCropImage={cropOnServer}
          onExtractWords={extractWordsFromScan}
          onImageClick={handleImageClick}
          onMovePoint={movePoint}
          onRemoveImage={removeImage}
          onSaveExtractedWords={saveExtractedWords}
          onRetry={retryFailedAction}
          onSelectedBaseChange={setSelectedBaseId}
          onNewBaseNameChange={setNewBaseName}
        />
      )}
    </section>
  );
}
