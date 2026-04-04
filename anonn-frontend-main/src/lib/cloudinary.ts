/**
 * Cloudinary utility functions for image uploads
 * Uses VITE_CLOUDINARY_URL and VITE_CLOUDINARY_UPLOAD_PRESET environment variables
 * 
 * VITE_CLOUDINARY_URL format: cloudinary://api_key:api_secret@cloud_name
 * Or just the cloud name: your-cloud-name
 * 
 * VITE_CLOUDINARY_UPLOAD_PRESET: your-upload-preset-name
 */

/**
 * Extract cloud name from VITE_CLOUDINARY_URL
 * Supports both full URL format and just cloud name
 */
function getCloudName(): string | null {
  const cloudinaryUrl = import.meta.env.VITE_CLOUDINARY_URL;
  
  if (!cloudinaryUrl) {
    return null;
  }

  // If it's just the cloud name (no protocol), return it directly
  if (!cloudinaryUrl.includes('://')) {
    return cloudinaryUrl;
  }

  // Parse cloudinary://api_key:api_secret@cloud_name
  try {
    const url = new URL(cloudinaryUrl);
    return url.hostname || null;
  } catch (error) {
    console.error('[cloudinary] Failed to parse VITE_CLOUDINARY_URL:', error);
    return null;
  }
}

/**
 * Upload image to Cloudinary (unsigned upload)
 * @param file - File object to upload
 * @param folder - Optional folder path in Cloudinary (default: 'user-pfps')
 * @param uploadPreset - Optional upload preset name (defaults to VITE_CLOUDINARY_UPLOAD_PRESET)
 * @returns Promise with the uploaded image URL
 */
export async function uploadImageToCloudinary(
  file: File,
  folder: string = 'user-pfps',
  uploadPreset?: string
): Promise<string> {
  // Get upload preset from parameter or environment variable
  const preset = uploadPreset || import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;
  
  if (!preset) {
    throw new Error(
      'Cloudinary upload preset not found. Please set VITE_CLOUDINARY_UPLOAD_PRESET environment variable.'
    );
  }

  // Get cloud name from VITE_CLOUDINARY_URL
  const cloudName = getCloudName();

  if (!cloudName) {
    throw new Error(
      'Cloudinary cloud name not found. Please set VITE_CLOUDINARY_URL environment variable.\n' +
      'Format: cloudinary://api_key:api_secret@cloud_name or just your-cloud-name'
    );
  }

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', preset);
  formData.append('folder', folder);
  formData.append('resource_type', 'image');

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message || 
        `Failed to upload image: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    return data.secure_url || data.url;
  } catch (error) {
    console.error('[cloudinary] Upload error:', error);
    throw error;
  }
}
