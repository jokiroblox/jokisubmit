document.getElementById('paymentForm').addEventListener('submit', function(event) {
    event.preventDefault();
    
    const nominal = document.getElementById('nominal').value;
    const qris = '00020101021126570011ID'; // Ganti dengan QRIS statis Anda

    // Menggunakan qris-dinamis untuk membuat QRIS dinamis
    const result = qrisDinamis.makeString(qris, { nominal: nominal });

    // Tampilkan QRIS
    const img = document.getElementById('qrisImage');
    img.src = 'data:image/png;base64,' + result; // Menggunakan base64 untuk menampilkan QRIS
    img.style.display = 'block';
});
