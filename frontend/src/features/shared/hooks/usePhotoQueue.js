import { useCallback, useEffect, useRef, useState } from 'react';
import { selectNewPhotos, uploadPhotoBatch } from '../components/photoQueue';

const preparePreview = (file) => new Promise((resolve, reject) => {
  const previewUrl = URL.createObjectURL(file);
  const image = new Image();
  image.onload = () => resolve({ previewUrl, width: image.naturalWidth, height: image.naturalHeight });
  image.onerror = () => {
    URL.revokeObjectURL(previewUrl);
    reject(new Error('No se puede abrir esta imagen. Seleccione otro archivo.'));
  };
  image.src = previewUrl;
});

export const usePhotoQueue = () => {
  const [photos, setPhotos] = useState([]);
  const [selectionMessages, setSelectionMessages] = useState([]);
  const [isPreparing, setIsPreparing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const photosRef = useRef([]);
  const busyRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    };
  }, []);

  const changePhotos = useCallback((update) => {
    photosRef.current = update(photosRef.current);
    if (mountedRef.current) setPhotos(photosRef.current);
  }, []);

  const addPhotos = useCallback(async (files) => {
    if (busyRef.current || !files.length) return false;
    busyRef.current = true;
    setIsPreparing(true);
    const { accepted, rejected, duplicates } = selectNewPhotos(files, photosRef.current);
    const prepared = [];
    try {
      for (const file of accepted) {
        try {
          const preview = await preparePreview(file);
          prepared.push({ id: crypto.randomUUID(), file, ...preview, status: 'pending', progress: 0, error: '' });
        } catch (error) {
          rejected.push({ name: file.name, error: error.message });
        }
      }

      if (!mountedRef.current) {
        prepared.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
        return;
      }
      changePhotos((prev) => [...prev, ...prepared]);
      setSelectionMessages([
        ...rejected.map(({ name, error }) => ({ type: 'error', text: `${name}: ${error}` })),
        ...(duplicates ? [{ type: 'info', text: `${duplicates} archivo${duplicates === 1 ? '' : 's'} ya estaba${duplicates === 1 ? '' : 'n'} en la selección; ${duplicates === 1 ? 'no se volvió a agregar' : 'no se volvieron a agregar'}.` }] : []),
      ]);
      return { accepted: prepared.length };
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setIsPreparing(false);
    }
  }, [changePhotos]);

  const removePhoto = useCallback((id) => {
    if (busyRef.current) return;
    changePhotos((prev) => prev.filter((photo) => {
      if (photo.id !== id || photo.status === 'uploaded') return true;
      URL.revokeObjectURL(photo.previewUrl);
      return false;
    }));
  }, [changePhotos]);

  const clearPendingPhotos = useCallback(() => {
    if (busyRef.current) return;
    changePhotos((prev) => prev.filter((photo) => {
      if (photo.status === 'uploaded') return true;
      URL.revokeObjectURL(photo.previewUrl);
      return false;
    }));
    setSelectionMessages([]);
  }, [changePhotos]);

  const clearPhotos = useCallback(() => {
    if (busyRef.current) return;
    photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl));
    changePhotos(() => []);
    setSelectionMessages([]);
  }, [changePhotos]);

  const uploadPhotos = useCallback(async (upload) => {
    if (busyRef.current) return null;
    busyRef.current = true;
    setIsUploading(true);
    try {
      return await uploadPhotoBatch(photosRef.current, upload, (id, patch) => {
        changePhotos((prev) => prev.map((photo) => photo.id === id ? { ...photo, ...patch } : photo));
      });
    } finally {
      busyRef.current = false;
      if (mountedRef.current) setIsUploading(false);
    }
  }, [changePhotos]);

  return {
    photos, selectionMessages, isPreparing, isUploading, isBusy: isPreparing || isUploading,
    addPhotos, removePhoto, clearPhotos, clearPendingPhotos, uploadPhotos,
  };
};
