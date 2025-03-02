// app.js
document.getElementById('paymentForm').addEventListener('submit', function(event) {
    event.preventDefault();
    
    const nominal = document.getElementById('nominal').value;

    // Anda perlu mengganti ini dengan QRIS yang valid
    const qris = '00020101021126570011ID........'; 

    // Logika untuk membuat QRIS
    // Ini tidak akan berfungsi di browser tanpa bundler
    const result = qrisDinamis.makeFile(qris, { nominal: nominal, path: 'output/qris.jpg' });

    // Tampilkan QRIS
    const img = document.getElementById('qrisImage');
    img.src = 'output/qris.jpg'; // Pastikan path ini sesuai dengan lokasi file
    img.style.display = 'block';
});
