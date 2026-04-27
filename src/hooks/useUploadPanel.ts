'use client'

import { useState, useCallback } from 'react'
import type { DocumentType, ExtractionResult } from '@/types/upload'

type Step = 1 | 2 | 3

interface UploadPanelState {
  isOpen: boolean
  step: Step
  folderId: string | null
  documentType: DocumentType | null
  file: File | null
  text: string
  extractionResult: ExtractionResult | null
  isLoading: boolean
  error: string | null
}

const initialState: UploadPanelState = {
  isOpen: false,
  step: 1,
  folderId: null,
  documentType: null,
  file: null,
  text: '',
  extractionResult: null,
  isLoading: false,
  error: null,
}

export function useUploadPanel() {
  const [state, setState] = useState<UploadPanelState>(initialState)

  const open = useCallback((folderId: string | null = null) => {
    setState({ ...initialState, isOpen: true, folderId })
  }, [])

  const close = useCallback(() => {
    setState(initialState)
  }, [])

  const setStep = useCallback((step: Step) => {
    setState(prev => ({ ...prev, step }))
  }, [])

  const setFolderId = useCallback((folderId: string | null) => {
    setState(prev => ({ ...prev, folderId }))
  }, [])

  const setDocumentType = useCallback((documentType: DocumentType) => {
    setState(prev => ({ ...prev, documentType }))
  }, [])

  const setFile = useCallback((file: File | null) => {
    setState(prev => ({ ...prev, file }))
  }, [])

  const setText = useCallback((text: string) => {
    setState(prev => ({ ...prev, text }))
  }, [])

  const setLoading = useCallback((isLoading: boolean) => {
    setState(prev => ({ ...prev, isLoading }))
  }, [])

  const setError = useCallback((error: string | null) => {
    setState(prev => ({ ...prev, error }))
  }, [])

  const setExtractionResult = useCallback((result: ExtractionResult) => {
    setState(prev => ({ ...prev, extractionResult: result, step: 2 }))
  }, [])

  const resetToStep1 = useCallback(() => {
    setState(prev => ({
      ...prev,
      step: 1,
      documentType: null,
      file: null,
      text: '',
      extractionResult: null,
      error: null,
    }))
  }, [])

  return {
    ...state,
    open,
    close,
    setStep,
    setFolderId,
    setDocumentType,
    setFile,
    setText,
    setLoading,
    setError,
    setExtractionResult,
    resetToStep1,
  }
}
