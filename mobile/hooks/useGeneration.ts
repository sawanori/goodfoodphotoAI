import { useState, useCallback } from 'react';
import {
  createGeneration,
  pollGenerationStatus,
  AspectRatio,
  GenerationResponse,
} from '../services/api/generation';

export interface UseGenerationResult {
  generating: boolean;
  progress: number;
  error: string | null;
  result: GenerationResponse | null;
  startGeneration: (imageData: string, aspectRatio: AspectRatio) => Promise<void>;
  reset: () => void;
}

export function useGeneration(): UseGenerationResult {
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerationResponse | null>(null);

  const startGeneration = useCallback(
    async (imageData: string, aspectRatio: AspectRatio) => {
      setGenerating(true);
      setProgress(0);
      setError(null);
      setResult(null);

      try {
        const initialResponse = await createGeneration({ imageData, aspectRatio });
        setProgress(25);

        const finalResponse = await pollGenerationStatus(
          initialResponse.taskId,
          (response) => {
            // Update progress based on status
            if (response.status === 'processing') {
              setProgress(50);
            } else if (response.status === 'completed') {
              setProgress(100);
            }
          }
        );

        setResult(finalResponse);
        setGenerating(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : '画像生成に失敗しました');
        setGenerating(false);
      }
    },
    []
  );

  const reset = useCallback(() => {
    setGenerating(false);
    setProgress(0);
    setError(null);
    setResult(null);
  }, []);

  return {
    generating,
    progress,
    error,
    result,
    startGeneration,
    reset,
  };
}
