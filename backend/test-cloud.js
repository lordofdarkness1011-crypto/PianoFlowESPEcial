require('dotenv').config();
const cloudinary = require('cloudinary').v2;

cloudinary.config({
  cloud_name: 'ddmlq20us',
  api_key: '819577197976976',
  api_secret: '_4vHyRjDfSP5kfqjTVn93x-lKls'
});

cloudinary.api.ping()
  .then(res => console.log('Success:', res))
  .catch(err => console.error('Error:', err));
