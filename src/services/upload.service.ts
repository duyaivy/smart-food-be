import streamifier from 'streamifier';
import cloudinary from '../config/cloudinary';

const uploadToCloudinary = (file: { buffer: Buffer }, folder = 'uploads') => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image'
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    streamifier.createReadStream(file.buffer).pipe(stream);
  });
};
const createAvatarUrl = (publicId: string, effectColor: string, backgroundColor: string) => {
  return cloudinary.url(publicId, {
    secure: true,
    transformation: [
      { width: 250, height: 250, gravity: 'faces', crop: 'thumb' },
      { radius: 'max' },
      { effect: 'outline:5', color: effectColor },
      { background: backgroundColor }
    ]
  });
};
export default {
  uploadToCloudinary,
  createAvatarUrl
};
