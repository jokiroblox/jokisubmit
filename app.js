// app.js
document.getElementById('paymentForm').addEventListener('submit', function(event) {
    event.preventDefault();
    
    const nominal = document.getElementById('nominal').value;

    fetch('/generate-qris', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ nominal: nominal })
    })
    .then(response => response.json())
    .then(data => {
        const img = document.getElementById('qrisImage');
        img.src = data.url; // Menggunakan URL yang dikirim dari server
        img.style.display = 'block';
    })
    .catch(error => console.error('Error:', error));
});
