import React, { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import './UploadModal.css';

function UploadModal({
  show,
  onClose,
  onSubmit,
  setUploadedFile,
  setColumns,
  setTargetVariable
}) {
  const { t } = useTranslation();
  const [selectedFile, setSelectedFile] = useState(null);
  const [datasetDescriptionFile, setDatasetDescriptionFile] = useState(null);
  const [datasetDescriptionError, setDatasetDescriptionError] = useState('');
  const [useLLMFeatureInference, setUseLLMFeatureInference] = useState(false);
  const [useLLMPersonalDataDetection, setUseLLMPersonalDataDetection] = useState(false);
  const [useLLMTaskTypeIdentification, setUseLLMTaskTypeIdentification] = useState(false);
  const [llmModel, setLlmModel] = useState('qwen3_instruct');
  const [cudaAvailable, setCudaAvailable] = useState(false);
  const [showLargeModelWarning, setShowLargeModelWarning] = useState(false);
  const [localColumns, setLocalColumns] = useState([]);
  const [localTarget, setLocalTarget] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadId, setUploadId] = useState(null);
  const [uploadSteps, setUploadSteps] = useState([]);
  const [uploadStage, setUploadStage] = useState('validate');
  const [uploadError, setUploadError] = useState('');
  const progressDialogRef = useRef(null);
  const showProgress = isLoading || Boolean(uploadError);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const isSubmittingRef = useRef(false);
  const datasetDescriptionInputRef = useRef(null);

  useEffect(() => {
    if (!show) {
      setSelectedFile(null);
      setDatasetDescriptionFile(null);
      setDatasetDescriptionError('');
      if (datasetDescriptionInputRef.current) {
        datasetDescriptionInputRef.current.value = '';
      }
      setLocalColumns([]);
      setLocalTarget('');
      setIsLoading(false);
      setUploadId(null);
      setUploadError('');
      setIsPreviewing(false);
      setPreviewError('');
      isSubmittingRef.current = false;
    }
  }, [show]);

  useEffect(() => {
    if (!show) return undefined;

    let active = true;
    fetch('/status', { credentials: 'include' })
      .then((response) => response.json())
      .then((status) => {
        if (active) setCudaAvailable(Boolean(status?.gpu?.cuda_available));
      })
      .catch(() => {
        if (active) setCudaAvailable(false);
      });

    return () => {
      active = false;
    };
  }, [show]);

  useEffect(() => {
    const dialog = progressDialogRef.current;
    if (show && showProgress && dialog && !dialog.open) dialog.showModal();
  }, [show, showProgress]);

  useEffect(() => {
    if (!uploadId) return undefined;

    const controller = new AbortController();
    let timer;
    const poll = async () => {
      try {
        const response = await fetch(`/upload/progress/${uploadId}`, {
          cache: 'no-store',
          credentials: 'same-origin',
          signal: controller.signal,
        });
        if (response.ok) {
          const { stage } = await response.json();
          if (!controller.signal.aborted && isSubmittingRef.current) setUploadStage(stage);
        }
      } catch {
        // The upload response still reports success or failure if polling is interrupted.
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(poll, 750);
      }
    };

    timer = setTimeout(poll, 750);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [uploadId]);

  const handleFileChange = (e) => {
    if (isSubmittingRef.current) return;
    if (e.target.files.length > 0) {
      const file = e.target.files[0];
      processFile(file);
    }
  };

  const handleDescriptionFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.txt')) {
      setDatasetDescriptionFile(null);
      setDatasetDescriptionError(t('datasetDescriptionTxtOnly'));
      e.target.value = '';
      return;
    }

    if (file.size === 0 || file.size > 32 * 1024) {
      setDatasetDescriptionFile(null);
      setDatasetDescriptionError(t('datasetDescriptionFileSize'));
      e.target.value = '';
      return;
    }

    setDatasetDescriptionFile(file);
    setDatasetDescriptionError('');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (isSubmittingRef.current) return;
    if (e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      processFile(file);
    }
  };

  const handleClose = () => {
    if (isSubmittingRef.current) return;
    onClose();
  };

  const handleModelChange = (event) => {
    if (event.target.value === 'qwen25_14b') {
      setShowLargeModelWarning(true);
      return;
    }
    setLlmModel(event.target.value);
  };

  const processFile = async (file) => {
    if (isSubmittingRef.current) return;
    setSelectedFile(file);
    setLocalColumns([]);
    setLocalTarget('');
    setPreviewError('');
    setIsPreviewing(true);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/preview', {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || 'Could not read the selected file.');
      }

      setLocalColumns(result.columns || []);
      setLocalTarget(result.columns?.[0] || '');
    } catch (error) {
      setPreviewError(error.message || 'Could not read the selected file.');
    } finally {
      setIsPreviewing(false);
    }
  };

  //Angepasst Test SL
  const handleSubmit = async () => {
    if (isSubmittingRef.current) return;

    if (!selectedFile || !localTarget) {
      alert("Bitte Datei und Zielvariable auswählen.");
      return;
    }

    const id = Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
      byte.toString(16).padStart(2, '0')
    ).join('');
    const steps = ['validate'];
    if (useLLMTaskTypeIdentification || useLLMFeatureInference || useLLMPersonalDataDetection) {
      steps.push('model');
    }
    if (useLLMTaskTypeIdentification) steps.push('taskType');
    if (useLLMFeatureInference && useLLMPersonalDataDetection) steps.push('combined');
    else if (useLLMFeatureInference) steps.push('featureType');
    else if (useLLMPersonalDataDetection) steps.push('personal');
    steps.push('quality');

    isSubmittingRef.current = true;
    setUploadSteps(steps);
    setUploadStage('validate');
    setUploadError('');
    setUploadId(id);
    setIsLoading(true);
    setUploadedFile(selectedFile);
    setColumns(localColumns);
    setTargetVariable(localTarget);

    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("target", localTarget);
    formData.append("upload_id", id);

    // LLM-Variablen korrekt an das Backend senden
    formData.append("use_llm_feature_type_inference", useLLMFeatureInference ? "true" : "false");
    formData.append("use_llm_personal_data_detection", useLLMPersonalDataDetection ? "true" : "false");
    formData.append("use_llm_task_type_identification", useLLMTaskTypeIdentification ? "true" : "false");
    formData.append("llm_model", llmModel);
    if (datasetDescriptionFile) {
      formData.append("dataset_description_file", datasetDescriptionFile);
    }

    try {
      const response = await fetch('/upload', {
        method: 'POST',
        body: formData
      });

      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.success) {
        if (steps.includes(result?.uploadStage)) setUploadStage(result.uploadStage);
        setUploadError(result?.error || t('uploadProgressError'));
        return;
      }

      setUploadId(null);
      await onSubmit(result);
    } catch (error) {
      setUploadError(error.message || t('uploadProgressError'));
    } finally {
      setUploadId(null);
      isSubmittingRef.current = false;
      setIsLoading(false);
    }
  };




  if (!show) return null;

  const activeStep = Math.max(uploadSteps.indexOf(uploadStage), 0);
  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div
        className="modal upload-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h2>{t('uploadTitle')}</h2>
          <button onClick={handleClose} className="close-btn" disabled={isLoading}>&times;</button>
        </div>

        <div
          className="dropzone"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <p>{t('dragDrop')}</p>
          <p className="file-limit">{t('fileLimit')}</p>
          <label htmlFor="file-input" className="browse-btn">
            {t('browseFiles')}
          </label>
          <input
            id="file-input"
            type="file"
            accept=".csv,.tsv,.xlsx,.arff,.json,.jsonl,.txt,.dat,.data,.arrow,.feather,.parquet,.pq"
            onChange={handleFileChange}
            disabled={isLoading || isPreviewing}
            style={{ display: 'none' }}
          />
        </div>

        {selectedFile && (
          <div className="uploaded-section">
            <div className="uploaded-file-info">
              <div>{selectedFile.name}</div>
              <div>{(selectedFile.size / 1024).toFixed(1)}KB</div>
            </div>

            <div className="upload-success">
              🙌 {t('dataUploaded')}
            </div>

            {isPreviewing && <div role="status">{t('readingFile')}</div>}
            {previewError && <div className="preview-error" role="alert">{previewError}</div>}

            <div>
              <label htmlFor="target-select" className="select-label">
                {t('selectTargetVariable')}
              </label>
              <select
                id="target-select"
                className="select-target"
                value={localTarget}
                onChange={(e) => setLocalTarget(e.target.value)}
                disabled={isLoading || isPreviewing || localColumns.length === 0}
              >
                {localColumns.map((col, idx) => (
                  <option key={idx} value={col}>{col}</option>
                ))}
              </select>
            </div>

            <div className="llm-settings-box">
              <div className="llm-settings-title">{t('llmSettingsTitle')}</div>

              <div className="llm-model-row">
                <label htmlFor="llm-model-select">{t('llmModel')}</label>
                <select
                  id="llm-model-select"
                  className="select-target"
                  value={llmModel}
                  disabled={isLoading}
                  onChange={handleModelChange}
                >
                  <option value="qwen3_instruct">{t('qwen3InstructModel')}</option>
                  <option value="qwen3_thinking">{t('qwen3ThinkingModel')}</option>
                  {/* <option value="gemma4_e4b">{t('gemma4E4bModel')}</option> */}
                  <option value="qwen25_14b" disabled={!cudaAvailable}>{t('qwen25_14bModel')}</option>
                </select>
              </div>

              <div className="dataset-description-upload">
                <label htmlFor="dataset-description-file" className="select-label">
                  {t('datasetDescriptionLabel')}
                </label>
                <input
                  id="dataset-description-file"
                  ref={datasetDescriptionInputRef}
                  type="file"
                  accept=".txt,text/plain"
                  onChange={handleDescriptionFileChange}
                  disabled={isLoading}
                />
                <div className="dataset-description-help">{t('datasetDescriptionHelp')}</div>
                {datasetDescriptionFile && (
                  <div className="dataset-description-file">
                    <span>{datasetDescriptionFile.name}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setDatasetDescriptionFile(null);
                        setDatasetDescriptionError('');
                        if (datasetDescriptionInputRef.current) {
                          datasetDescriptionInputRef.current.value = '';
                        }
                      }}
                      disabled={isLoading}
                    >
                      {t('remove')}
                    </button>
                  </div>
                )}
                {datasetDescriptionError && (
                  <div className="preview-error" role="alert">{datasetDescriptionError}</div>
                )}
              </div>

              <div className="toggle-row">
                <span>{t('useLLMFeatureTypeInference')}</span>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={useLLMFeatureInference}
                    disabled={isLoading}
                    onChange={() => {
                      const newValue = !useLLMFeatureInference;
                      setUseLLMFeatureInference(newValue);
                      console.log("LLM Feature Type Inference:", newValue);
                    }}
                  />
                  <span className="slider round"></span>
                </label>
              </div>

              <div className="toggle-row">
                <span>{t('useLLMPersonalDataDetection')}</span>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={useLLMPersonalDataDetection}
                    disabled={isLoading}
                    onChange={() => {
                      const newValue = !useLLMPersonalDataDetection;
                      setUseLLMPersonalDataDetection(newValue);
                      console.log("LLM Personalized Data Detection:", newValue);
                    }}
                  />
                  <span className="slider round"></span>
                </label>
              </div>

              <div className="toggle-row">
                <span>{t('useLLMTaskTypeIdentification')}</span>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={useLLMTaskTypeIdentification}
                    disabled={isLoading}
                    onChange={() => setUseLLMTaskTypeIdentification((value) => !value)}
                  />
                  <span className="slider round"></span>
                </label>
              </div>
            </div>


            <button className="submit-btn" onClick={handleSubmit} disabled={isLoading || isPreviewing || localColumns.length === 0}>
              {isLoading ? (
                <>
                  <span className="spinner"></span> {t('submit')} {t('loading') || 'wird verarbeitet...'}
                </>
              ) : (
                t('submit')
              )}
            </button>
          </div>
        )}
      </div>

      {showProgress && (
        <dialog
          ref={progressDialogRef}
          className="model-warning-dialog upload-progress-dialog"
          aria-labelledby="upload-progress-title"
          onClick={(event) => event.stopPropagation()}
          onCancel={(event) => {
            event.preventDefault();
            if (uploadError) setUploadError('');
          }}
        >
          <h2 id="upload-progress-title">
            {t(uploadError ? 'uploadProgressFailed' : 'uploadProgressTitle')}
          </h2>
          <progress
            aria-label={t('uploadProgressTitle')}
            value={activeStep}
            max={uploadSteps.length}
          />
          <ol aria-live="polite">
            {uploadSteps.map((stage, index) => {
              let status = 'uploadProgressPending';
              if (index < activeStep) status = 'uploadProgressDone';
              if (index === activeStep) {
                status = uploadError ? 'uploadProgressFailedStep' : 'uploadProgressRunning';
              }
              return (
                <li key={stage} aria-current={index === activeStep ? 'step' : undefined}>
                  <span>{t(`uploadProgressStages.${stage}`)}</span>
                  <span>
                    {status === 'uploadProgressRunning' && <i className="spinner" aria-hidden="true" />}
                    {t(status)}
                  </span>
                </li>
              );
            })}
          </ol>
          {uploadStage === 'model' && !uploadError && <p>{t('uploadProgressModelHint')}</p>}
          {uploadError && (
            <>
              <p role="alert">{uploadError}</p>
              <div className="model-warning-actions">
                <button
                  type="button"
                  className="model-warning-cancel"
                  onClick={() => setUploadError('')}
                >
                  {t('uploadProgressBack')}
                </button>
              </div>
            </>
          )}
        </dialog>
      )}

      {showLargeModelWarning && (
        <div
          className="model-warning-overlay"
          onClick={() => setShowLargeModelWarning(false)}
        >
          <section
            className="model-warning-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="model-warning-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="model-warning-title">{t('largeModelWarningTitle')}</h2>
            <p>{t('largeModelWarningBody')}</p>
            <p>{t('largeModelWarningFailure')}</p>
            <div className="model-warning-actions">
              <button
                type="button"
                className="model-warning-cancel"
                onClick={() => setShowLargeModelWarning(false)}
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                className="model-warning-continue"
                onClick={() => {
                  setLlmModel('qwen25_14b');
                  setShowLargeModelWarning(false);
                }}
              >
                {t('continue')}
              </button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default UploadModal;
