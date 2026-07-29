const cloudinary = require('cloudinary').v2;
const { env } = require('../config/env');

if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({ 
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME, 
    api_key: process.env.CLOUDINARY_API_KEY, 
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}
// Si no hay CLOUDINARY_CLOUD_NAME, la librería de Cloudinary usará automáticamente 
// process.env.CLOUDINARY_URL si existe.

const uploadImage = (fileBuffer, folder = 'pianoflows_avatars') => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
        transformation: [{ width: 500, height: 500, crop: 'limit' }]
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    uploadStream.end(fileBuffer);
  });
};

module.exports = {
  uploadImage
};
