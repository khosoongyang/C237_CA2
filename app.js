const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const fs = require('fs');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.static(path.join(__dirname, 'views')));
app.use(express.static('public'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.urlencoded({ extended: false }));
app.use(session({
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: true
}));
app.use(flash());

// Multer configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// MySQL connection
const connection = mysql.createConnection({
    host: 'c237-all.mysql.database.azure.com',
    user: 'c237admin',
    password: 'c2372025!',
    database: 'c237_clothingstoreapp',
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

// Helper to get categories
function getCategories(callback) {
    connection.query('SELECT DISTINCT category FROM products', (err, results) => {
        if (err) return callback(err, []);
        const categories = results.map(row => row.category);
        callback(null, categories);
    });
}

// Home route with search/filter and categories
app.get('/', (req, res) => {
    const search = req.query.search || '';
    const selectedCategory = req.query.category || '';
    let sql = 'SELECT * FROM products WHERE 1=1';
    let params = [];
    if (search) {
        sql += ' AND productName LIKE ?';
        params.push('%' + search + '%');
    }
    if (selectedCategory) {
        sql += ' AND category = ?';
        params.push(selectedCategory);
    }
    connection.query(sql, params, (error, products) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error retrieving products: ' + error.message);
        }
        getCategories((err, categories) => {
            if (err) {
                return res.status(500).send('Error retrieving categories: ' + err.message);
            }
            res.render('index', {
                products,
                categories,
                search,
                selectedCategory
            });
        });
    });
});

// Add Product Form Page
app.get('/addProduct', (req, res) => {
    getCategories((err, categories) => {
        if (err) return res.status(500).send('Error retrieving categories');
        res.render('addProduct', { categories });
    });
});

// Add Product Logic
app.post('/addProduct', upload.single('image'), (req, res) => {
    const { productName, quantity, price, description, category } = req.body;
    let image = req.file ? req.file.filename : null;
    const sql = 'INSERT INTO products (productName, quantity, price, image, description, category) VALUES (?, ?, ?, ?, ?, ?, ?)';
    connection.query(sql, [productName, quantity, price, image, description, category], (error) => {
        if (error) {
            console.error("Error adding product: ", error);
            res.status(500).send('Error adding product: ' + error.message);
        } else {
            res.redirect('/');
        }
    });
});

// Edit Product Form
app.get('/editProduct/:id', (req, res) => {
    const productId = req.params.id;
    connection.query('SELECT * FROM products WHERE productId = ?', [productId], (err, result) => {
        if (err) return res.status(500).send('Error retrieving product');
        if (result.length === 0) return res.status(404).send('Product not found');
        getCategories((err, categories) => {
            if (err) return res.status(500).send('Error retrieving categories');
            res.render('editProduct', { product: result[0], categories });
        });
    });
});

// Edit Product Logic
app.post('/editProduct/:id', upload.single('image'), (req, res) => {
    const productId = req.params.id;
    const { productName, quantity, price, description, category, currentImage } = req.body;
    let image = currentImage;
    if (req.file) {
        image = req.file.filename;
    }
    const sql = 'UPDATE products SET productName = ?, quantity = ?, price = ?, image = ?, description = ?, category = ? WHERE productId = ?';
    connection.query(sql, [productName,  quantity, price, image, description, category, productId], (error) => {
        if (error) {
            console.error("Error updating product:", error);
            res.status(500).send('Error updating product');
        } else {
            res.redirect('/');
        }
    });
});

// Delete Product
app.get('/deleteProduct/:id', (req, res) => {
    const productId = req.params.id;
    connection.query('DELETE FROM products WHERE productId = ?', [productId], (err) => {
        if (err) return res.status(500).send('Error deleting product');
        res.redirect('/');
    });
});

// Product Details Page
app.get('/products/:id', (req, res) => {
    const productId = req.params.id;
    connection.query('SELECT * FROM products WHERE productId = ?', [productId], (err, result) => {
        if (err) return res.status(500).send('Database error');
        if (result.length === 0) return res.status(404).send('Product not found');
        res.render('productDetail', { product: result[0] });
    });
});

// Register Route
app.get('/register', (req, res) => {
    res.render('register', { messages: req.flash('error'), formData: req.flash('formData')[0] });
});

// Validate Registration Middleware
const validateRegistration = (req, res, next) => {
    const { username, email, password, address, contact } = req.body;
    if (!username || !email || !password || !address || !contact) {
        req.flash('error', 'All fields are required.');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    if (password.length < 8) {
        req.flash('error', 'Password should be at least 8 or more characters long');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    next();
};

app.post('/register', validateRegistration, (req, res) => {
    const { username, email, password, address, contact, role } = req.body;
    const sql = 'INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, SHA1(?), ?, ?, ?)';
    connection.query(sql, [username, email, password, address, contact, role], (err) => {
        if (err) {
            req.flash('error', 'Registration failed: ' + err.message);
            req.flash('formData', req.body);
            return res.redirect('/register');
        }
        req.flash('success', 'Registration successful! Please log in.');
        res.redirect('/login');
    });
});

// Login Route
app.get('/login', (req, res) => {
    res.render('login', { messages: req.flash('success'), errors: req.flash('error') });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/login');
    }
    const sql = 'SELECT * FROM users WHERE email = ? AND password = SHA1(?)';
    connection.query(sql, [email, password], (err, results) => {
        if (err) throw err;
        if (results.length > 0) {
            req.session.user = results[0];
            req.flash('success', 'Login successful!');
            res.redirect('/');
        } else {
            req.flash('error', 'Invalid email or password.');
            res.redirect('/login');
        }
    });
});

// Sell Route (redirects to addProduct)
app.get('/sell', (req, res) => {
    res.redirect('/addProduct');
});

// Start server
app.listen(3000, () => {
    console.log('Server running at http://localhost:3000');
});