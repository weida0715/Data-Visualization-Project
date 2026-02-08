const express = require('express');
const path = require('path');

const app = express();
const PORT = 8000;

// serve everything in this folder (index.html, js/, dataset/, css/, etc.)
app.use(express.static(__dirname));

// optional: make "/" open index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
