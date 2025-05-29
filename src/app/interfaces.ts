
export interface Description {
  image_id: number;
  type_of_lesion: string;
  site: string;
  count: string;
  arrangement: string;
  size: string;
  color_pattern: string;
  border: string;
  surface_changes: string;
  presence_of_exudate_or_discharge: string;
  surrounding_skin_changes: string;
  secondary_changes: string;
  pattern_or_shape: string;
  additional_notes: string;
  overall_description: string;
  label: string[];
}

export interface DiscussionPoint {
  discussionPoint: string;
  username: string;
  date: string;
  annotatorId: string;
  fileName: string;
  imageUrl?: string;
  description?: Description;
}

export interface ImageResponse {
  success: boolean;
  data: {
    imageUrl: string;
    description: Description;
    discussionPoint?: string;
  };
}

export interface ApiResponse {
  success: boolean;
  data: DiscussionPoint[];
}

export interface AnnotatedData {
  [key: string]: any;
}

export interface ImageOptions {
  format?: 'webp' | 'jpeg' | 'png' | 'avif';
  width?: number;
  quality?: number;
}

export interface AnnotatorCount {
  name: string;
  count: number;
}

export interface Description {
  image_id: number;
  type_of_lesion: string;
  site: string;
  count: string;
  arrangement: string;
  size: string;
  color_pattern: string;
  border: string;
  surface_changes: string;
  presence_of_exudate_or_discharge: string;
  surrounding_skin_changes: string;
  secondary_changes: string;
  pattern_or_shape: string;
  additional_notes: string;
  overall_description: string;
  label: string[];
}

export interface DiscussionPoint {
  discussionPoint: string;
  username: string;
  date: string;
  annotatorId: string;
  fileName: string;
  imageUrl?: string;
  description?: Description;
}

export interface ApiResponse {
  success: boolean;
  data: DiscussionPoint[];
}

// Define the DiscussionPoint interface (or import it from a shared file)
export interface Description {
  image_id: number;
  type_of_lesion: string;
  site: string;
  count: string;
  arrangement: string;
  size: string;
  color_pattern: string;
  border: string;
  surface_changes: string;
  presence_of_exudate_or_discharge: string;
  surrounding_skin_changes: string;
  secondary_changes: string;
  pattern_or_shape: string;
  additional_notes: string;
  overall_description: string;
  label: string[];
}

export interface DiscussionPoint {
  discussionPoint: string;
  username: string;
  date: string;
  annotatorId: string;
  fileName: string;
  imageUrl?: string;
  description?: Description;
}

export interface ImageResponse {
  success: boolean;
  data: {
    imageUrl: string;
    description: Description;
    discussionPoint?: string;
  };
}

export interface PatientImage {
  name: string;
  fullPath: string;
  url: string;
}

export interface PatientImagesResponse {
  success: boolean;
  data?: {
    patientId: string;
    images: PatientImage[];
    count: number;
  };
  error?: string;
  details?: string;
}

export interface AllPatientImagesResponse {
  success: boolean;
  data: {
    directory: string;
    images: PatientImage[];
    count: number;
  };
  message?: string;
}

export interface AnnotationData {
  patientId: string;
  fileName: string;
  legible: boolean;
  nonLegible: boolean;
  checklistItems: {
    blurry?: boolean;
    dark?: boolean;
    obstructed?: boolean;
    quality?: boolean;
    incomplete?: boolean;
    other?: boolean;
  };
  username: string;
}

export interface AnnotationResponse {
  success: boolean;
  message?: string;
  data?: { totalRecords: number };
}

export interface AnnotationStats {
  totalAnnotations: number;
  legibleCount: number;
  nonLegibleCount: number;
}


