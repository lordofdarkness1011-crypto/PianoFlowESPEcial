require('dotenv').config();
const jwt = require('jsonwebtoken');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const { exec } = require('child_process');

process.env.CLOUDINARY_URL="cloudinary://819577197976976:_4vHyRjDfSP5kfqjTVn93x-lKls@ddmlq20us";
const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });

const form = new FormData();
form.append('avatar', fs.createReadStream('./package.json'));

const server = exec('node server.js');
setTimeout(() => {
  axios.post('http://localhost:3000/api/auth/avatar', form, {
    headers: {
      ...form.getHeaders(),
      'Authorization': `Bearer ${token}`
    }
  }).then(res => {
    console.log('Success:', res.data);
    server.kill();
  }).catch(err => {
    console.log('Error data:', err.response ? err.response.data : err.message);
    server.kill();
  });
}, 2000);
