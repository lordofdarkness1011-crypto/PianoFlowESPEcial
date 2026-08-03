process.env.CLOUDINARY_URL="cloudinary://819577197976976:_4vHyRjDfSP5kfqjTVn93x-lKls@ddmlq20us";
const cloudinary = require('cloudinary').v2;
const fs = require('fs');

const tinyPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", 'base64');

const uploadStream = cloudinary.uploader.upload_stream(
  {
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp']
  },
  (error, result) => {
    if (error) console.error('Error:', error);
    else console.log('Success:', result.secure_url);
  }
);
uploadStream.end(tinyPng);
