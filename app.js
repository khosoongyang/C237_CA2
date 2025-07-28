
//
app.get('/deleteProduct/:id', (req, res) => {
    const productId = req.params.id;

    connection.query('DELETE FROM products WHERE productId = ?', [productId], (error, results) => {
        if (error) {
            // Handle any error that occurs during the database operation
            console.error("Error deleting product:", error);
            res.status(500).send('Error deleting product');
        } else {
            // Send a success response
            res.redirect('/inventory');
        }
    });
});
const connection= mysql.createConnection({
  host: 'c237-all.mysql.database.azure.com',
  user: 'c237admin',
  password: 'c2372025!', // safer to use env vars
  database: '',
  port: 3306,
  ssl: { rejectUnauthorized: true } // if using Azure, may need SSL config
});

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
});