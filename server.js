// server.js
const express = require('express');
const bodyParser = require('body-parser');
const qrisDinamis = require('qris-dinamis');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(bodyParser.json());
app.use(express.static('public')); // Folder untuk file statis

app.post('/generate-qris', (req, res) => {
    const nominal = req.body.nominal;
    const qris = '00020101021126570011ID........'; // Ganti dengan QRIS yang valid

    // Buat QRIS
    const result = qrisDinamis.makeFile(qris, { nominal: nominal, path: 'output/qris.jpg' });

    // Kirim kembali URL QRIS
    res.json({ url: '/output/qris.jpg' });
});

app.listen(3000, () => {
    console.log('Server berjalan di http://localhost:3000');
});
