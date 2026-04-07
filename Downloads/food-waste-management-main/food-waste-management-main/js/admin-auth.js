document.getElementById('adminLoginBtn').addEventListener('click', () => {
    const email = document.getElementById('adminEmail').value;
    const pass = document.getElementById('adminPassword').value;
    if (email === 'musaliar123@gmail.com' && pass === 'Password@123') {
        localStorage.setItem('adminAuth', 'true');
        window.location.href = 'admin-dashboard.html';
    } else {
        alert('Invalid Admin Credentials');
    }
});
