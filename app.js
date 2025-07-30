const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');
const flash = require('connect-flash');

const app = express();

app.use(session({
    secret: 'yourSecretKey', // Change this to a secure, random string!
    resave: false,
    saveUninitialized: false
}));
app.use(flash());

// ---- MySQL Connection Pool ---- //
// Use createPool for better connection management in a web application
const pool = mysql.createPool({
    host: 'c237-all.mysql.database.azure.com',
    user: 'c237admin',
    password: 'c2372025!',
    database: 'c237_clothingstoreapp',
    port: 3306,
    ssl: { rejectUnauthorized: true },
    waitForConnections: true, // If true, the pool will queue connections if no connection is available
    connectionLimit: 10, // Max number of connections in the pool
    queueLimit: 0 // No limit to the number of requests queued
});

// Test the connection pool
pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ MySQL connection pool failed to get a connection:', err);
        process.exit(1); // Exit if we can't get a connection from the pool
    }
    console.log('✅ Connected to MySQL database via pool');
    if (connection) connection.release(); // Release the test connection
});

// Handle pool errors
pool.on('error', err => {
    console.error('❌ MySQL Pool Error:', err.code); // Log general pool errors
});


// Configure where to store the files
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// ---- Middleware Setup ---- //
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Make user available to all views
app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

// ---- Authentication Middleware ---- //
function requireLogin(req, res, next) {
    if (!req.session.user) return res.redirect('/login');
    next();
}

// ---- Home Page ---- //
app.get('/', (req, res) => {
    // This route might display general categories or featured products
    res.render('index', { categories: ['Women', 'Men', 'Baby', 'Kids'] }); // Added Kids here for consistency
});

// ---- Category Pages (Displaying Type Cards) ---- //
// These routes fetch all products for the main category to show the type cards
app.get('/women', (req, res) => {
    const categoryName = 'Women';
    const sql = 'SELECT * FROM products WHERE category = ?';
    pool.query(sql, [categoryName], (err, products) => { // Changed connection.query to pool.query
        if (err) {
            console.error('Error fetching women\'s products:', err);
            return res.status(500).send('Error retrieving products for Women\'s category');
        }
        res.render('category', { category: categoryName, products: products, user: req.session.user });
    });
});

app.get('/men', (req, res) => {
    const categoryName = 'Men';
    const sql = 'SELECT * FROM products WHERE category = ?';
    pool.query(sql, [categoryName], (err, products) => { // Changed connection.query to pool.query
        if (err) {
            console.error('Error fetching men\'s products:', err);
            return res.status(500).send('Error retrieving products for Men\'s category');
        }
        res.render('category', { category: categoryName, products: products, user: req.session.user });
    });
});

app.get('/kids', (req, res) => {
    const categoryName = 'Kids';
    const sql = 'SELECT * FROM products WHERE category = ?';
    pool.query(sql, [categoryName], (err, products) => { // Changed connection.query to pool.query
        if (err) {
            console.error('Error fetching kids\' products:', err);
            return res.status(500).send('Error retrieving products for Kids\' category');
        }
        res.render('category', { category: categoryName, products: products, user: req.session.user });
    });
});

app.get('/baby', (req, res) => {
    const categoryName = 'Baby';
    const sql = 'SELECT * FROM products WHERE category = ?';
    pool.query(sql, [categoryName], (err, products) => { // Changed connection.query to pool.query
        if (err) {
            console.error('Error fetching baby\'s products:', err);
            return res.status(500).send('Error retrieving products for Baby\'s category');
        }
        res.render('category', { category: categoryName, products: products, user: req.session.user });
    });
});

// ---- NEW: Filtered Products by Category and Type ---- //
// This route fetches and displays products based on category AND type query parameters
app.get('/products', (req, res) => {
    const { category, type } = req.query; // Get category and type from query parameters

    let sql = 'SELECT * FROM products WHERE 1=1'; // Start with a true condition
    const params = [];

    if (category) {
        sql += ' AND category = ?';
        params.push(category);
    }
    if (type) {
        sql += ' AND type = ?';
        params.push(type);
    }

    pool.query(sql, params, (err, products) => { // Changed connection.query to pool.query
        if (err) {
            console.error('Error fetching filtered products:', err);
            return res.status(500).send('Error retrieving filtered products');
        }
        // Render the filteredProducts.ejs template
        res.render('filteredProducts', {
            category: category || 'All Categories', // Pass category for display
            type: type || 'All Types', // Pass type for display
            products: products,
            user: req.session.user // Pass user session for header
        });
    });
});

// ---- Individual Product Detail Page (Placeholder) ---- //
app.get('/product/:productId', (req, res) => {
    const productId = req.params.productId;
    const sql = 'SELECT * FROM products WHERE productId = ?';
    pool.query(sql, [productId], (err, results) => { // Changed connection.query to pool.query
        if (err) {
            console.error('Error fetching single product:', err);
            return res.status(500).send('Error retrieving product details');
        }
        if (results.length > 0) {
            res.render('productDetail', { product: results[0], user: req.session.user }); // Assuming productDetail.ejs
        } else {
            res.status(404).send('Product not found');
        }
    });
});


// ---- User Profile ---- //
app.get('/user', requireLogin, (req, res) => {
    const user = req.session.user;
    res.render('user', {
        username: user.username,
        email: user.email,
        address: user.address,
        gender: user.gender,
        contact: user.contact,
        profilepic: user.profilepic,
        firstname: user.firstname,
        lastname: user.lastname,
        role: user.role,
        user: req.session.user // Ensure user object is passed
    });
});

// ---- Search ---- //
app.get('/search', (req, res) => {
    res.render('search-results', {
        searchQuery: req.query.q || '',
        categories: ['Women', 'Men', 'Baby', 'Kids'], // Added Kids here
        user: req.session.user // Pass user session for header
    });
});
app.post('/search', (req, res) => {
    const q = req.body.q || '';
    res.redirect(`/search?q=${encodeURIComponent(q)}`);
});

// ---- Language Selection (Optional) ---- //
app.post('/language', (req, res) => res.redirect('back'));

// ---- Register Form ----
app.get('/register', (req, res) => {
    res.render('register', { formData: {}, errors: [], user: req.session.user });
});

app.post('/register', upload.single('profilepic'), (req, res) => {
    const { username, email, password, gender, address, contact, firstname, lastname, role } = req.body;
    const profilepic = req.file ? req.file.filename : 'default.png';

    pool.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => { // Changed connection.query to pool.query
        if (err) {
            console.error('Registration error:', err);
            return res.status(500).send('Error checking user');
        }
        if (results.length > 0) {
            return res.render('register', { formData: req.body, errors: ['Email already exists'], user: req.session.user });
        }

        const sql = 'INSERT INTO users (username, email, password, gender, address, contact, firstname, lastname, role, profilepic) VALUES (?, ?, SHA1(?), ?, ?, ?, ?, ?, ?, ?)';
        pool.query(sql, [username, email, password, gender, address, contact, firstname, lastname, role, profilepic], (err, result) => { // Changed connection.query to pool.query
            if (err) {
                console.error('Registration error:', err);
                return res.render('register', { formData: req.body, errors: ['Registration failed'], user: req.session.user });
            }
            req.session.user = { username, email, gender, address, contact, firstname, lastname, role, profilepic };
            res.render('register-success', { username, user: req.session.user });
        });
    });
});

// ---- Login ---- //
app.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render('login', { errors: [], messages: [], user: req.session.user });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    const sql = 'SELECT * FROM users WHERE email = ? AND password = SHA1(?)';
    pool.query(sql, [email, password], (err, results) => { // Changed connection.query to pool.query
        if (err) {
            console.error("Login database error:", err);
            return res.status(500).send('Login error');
        }
        if (results.length === 0) {
            return res.render('login', { errors: ['Invalid email or password'], messages: [], user: req.session.user });
        }
        req.session.user = results[0];
        res.redirect('/');
    });
});

// ---- Logout ---- //
app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/login'));
});

// ---- Add Product (Form) ---- //
app.get('/addProduct', (req, res) => {
    res.render('addProduct', {
        errors: req.flash('errors') || [],
        success: req.flash('success') || "",
        formData: req.flash('formData')[0] || {},
        user: req.session.user // Pass user session for header
    });
});

app.post('/addProduct', upload.single('image'), (req, res) => {
    const { productName, category, type, quantity, price, description } = req.body;
    const image = req.file ? req.file.filename : null;

    // Declare SQL first!
    const sql = 'INSERT INTO products (productName, category, type, quantity, price, image, description) VALUES (?, ?, ?, ?, ?, ?, ?)';
    // Now log
    console.log("INSERT SQL:", sql);
    console.log("VALUES:", [productName, category, type, quantity, price, image, description]);

    pool.query(sql, [productName, category, type, quantity, price, image, description], (err, result) => {
        if (err) {
            console.error('Add product error:', err);
            if (req.file) {
                fs.unlink(req.file.path, (unlinkErr) => {
                    if (unlinkErr) console.error('Error deleting uploaded file on DB error:', unlinkErr);
                });
            }
            req.flash('errors', [err.sqlMessage || 'Error adding product: Please try again.']);
            req.flash('formData', req.body);
            return res.redirect('/addProduct');
        }
        req.flash('success', 'Product added successfully!');
        res.redirect('/addProduct');
    });
});

// ---- Edit Product ---- //
app.post('/editProduct/:id', upload.single('image'), (req, res) => {
    const { productName, quantity, price, description, currentImage } = req.body;
    const image = req.file ? req.file.filename : currentImage;
    const productId = req.params.id;

    const sql = 'UPDATE products SET productName = ?, quantity = ?, price = ?, image = ?, description = ? WHERE productId = ?';
    pool.query(sql, [productName, quantity, price, image, description, productId], (err, result) => { // Changed connection.query to pool.query
        if (err) {
            console.error('Edit product error:', err);
            return res.status(500).send('Error editing product');
        }
        res.redirect('/product');
    });
});

// --- GET route for the Sell Item form ---
app.get('/sell', requireLogin, (req, res) => {
    if (!req.session.user) {
        req.flash('error', 'Please log in to sell an item.');
        return res.redirect('/login');
    }
    res.render('addProduct', {
        errors: req.flash('error') || [],
        success: req.flash('success') || "",
        formData: req.flash('formData')[0] || {},
        user: req.session.user // Pass user session for header
    });
});
app.post('/sell', upload.single('image'), (req, res) => {
    const { productName, quantity, price, description, category, type } = req.body;
    const image = req.file ? req.file.filename : null;

    const sql = `
        INSERT INTO products (productName, quantity, price, image, description, category, type)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    pool.query(sql, [productName, quantity, price, image, description, category, type], (err, result) => {
        if (err) {
            console.error('Add product error:', err);
            return res.status(500).send('Error adding product');
        }
        res.redirect('/product'); // or wherever your product list page is
    });
});
// ---- Start Server ---- //
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🧵 Seam & Soul app running at http://localhost:${PORT}!`);
});
