const mysql = require('mysql2');

const connection = mysql.createConnection({
  host: 'c237-all.mysql.database.azure.com',
  user: 'c237admin',
  password: 'c2372025!',
  database: 'supermarket', // ✅ use your actual DB name here
  port: 3306,
  ssl: { rejectUnauthorized: true }
});

// Step 1: Import Express
const express = require('express');

// Step 2: Create the app object
const app = express();

// NO need to call connection.connect()

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
