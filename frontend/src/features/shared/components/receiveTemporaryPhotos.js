export const receiveTemporaryPhotos = async (photos, { received, download, add, isAvailable }) => {
  const pending = photos.filter((photo) => !received.has(photo.id));
  const ready = [];
  const failed = [];

  for (const photo of pending) {
    if (!isAvailable()) return { received: 0, failed, interrupted: true };
    try {
      ready.push({ id: photo.id, file: await download(photo) });
    } catch (error) {
      failed.push({ id: photo.id, error });
    }
  }

  if (!ready.length || !isAvailable()) return { received: 0, failed, interrupted: !isAvailable() };
  const result = await add(ready.map(({ file }) => file));
  if (result === false) return { received: 0, failed, interrupted: true };

  for (const { id } of ready) received.add(id);
  return { received: ready.length, accepted: typeof result === 'object' ? result.accepted : ready.length, failed, interrupted: false };
};
