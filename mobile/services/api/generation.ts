import { apiRequest } from './client';

export type AspectRatio = '4:5' | '9:16' | '16:9' | '1:1';

export interface GenerationRequest {
  imageData: string; // Base64 encoded image
  aspectRatio: AspectRatio;
}

export interface GenerationResponse {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  images?: string[]; // Array of 4 image URLs
  error?: string;
}

export async function createGeneration(
  request: GenerationRequest
): Promise<GenerationResponse> {
  return apiRequest<GenerationResponse>('/generations', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export async function getGenerationStatus(taskId: string): Promise<GenerationResponse> {
  return apiRequest<GenerationResponse>(`/generations/${taskId}`);
}

export async function pollGenerationStatus(
  taskId: string,
  onUpdate: (response: GenerationResponse) => void,
  intervalMs: number = 2000
): Promise<GenerationResponse> {
  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const response = await getGenerationStatus(taskId);
        onUpdate(response);

        if (response.status === 'completed') {
          clearInterval(interval);
          resolve(response);
        } else if (response.status === 'failed') {
          clearInterval(interval);
          reject(new Error(response.error || 'Generation failed'));
        }
      } catch (error) {
        clearInterval(interval);
        reject(error);
      }
    }, intervalMs);
  });
}
