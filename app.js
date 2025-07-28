const express = require('express');
const app = express();
const mysql = require('mysql2');
const path = require('path');

// Serve static HTML files
app.use(express.static(path.join(__dirname, 'views')));

// MySQL connection
const connection = mysql.createConnection({
  host: 'c237-all.mysql.database.azure.com',
  user: 'c237admin',
  password: 'c2372025!',
  database: '',
  port: 3306,
  ssl: { rejectUnauthorized: true }
});

connection.connect((err) => {
  if (err) {
    console.error('Error connecting to MySQL:', err);
    return;
  }
  console.log('Connected to MySQL database');
});

// Home route
app.get('/', (req, res) => {
  res.send('Welcome to the app');
  // or res.redirect('/inventory');
});

// Delete product
app.get('/deleteProduct/:id', (req, res) => {
  const productId = req.params.id;

  connection.query('DELETE FROM products WHERE productId = ?', [productId], (error, results) => {
    if (error) {
      console.error("Error deleting product:", error);
      res.status(500).send('Error deleting product');
    } else {
      res.redirect('/inventory');
    }
  });
});

// Start server
app.listen(3000, () => {
  console.log('Server running at http://localhost:3000');
});
