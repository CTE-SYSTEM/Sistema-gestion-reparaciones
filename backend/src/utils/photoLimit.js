export const maxPhotoBytes = process.env.VERCEL === '1' ? 4 * 1024 * 1024 : 5 * 1024 * 1024;
export const photoBodyLimit = process.env.VERCEL === '1' ? '4mb' : '5mb';
export const photoLimitLabel = process.env.VERCEL === '1' ? '4 MB' : '5 MB';
