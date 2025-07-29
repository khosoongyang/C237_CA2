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

// ---- MySQL Connection ---- //
const connection = mysql.createConnection({
    host: 'c237-all.mysql.database.azure.com',
    user: 'c237admin',
    password: 'c2372025!',
    database: 'c237_clothingstoreapp',
    port: 3306,
    ssl: { rejectUnauthorized: true }
});

connection.connect(err => {
    if (err) {
        console.error('❌ MySQL connection failed:', err);
        process.exit(1);
    }
    console.log('✅ Connected to MySQL database');
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

app.use(session({
    secret: 'your_secret_here',
    resave: false,
    saveUninitialized: false
}));

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
    res.render('index', { categories: ['Women', 'Men', 'Baby'] });
});

// ---- Category Pages ---- //
app.get('/women', (req, res) => res.render('category', { category: 'Women' }));
app.get('/men', (req, res) => res.render('category', { category: 'Men' }));
app.get('/baby', (req, res) => res.render('category', { category: 'Baby' }));

// ---- Favorites ---- //
app.get('/favorites', (req, res) => {
    res.render('favorites');
});

// ---- Cart ---- //
app.get('/cart', (req, res) => {
    const cart = []; // You can enhance this with session or DB later
    res.render('cart', { cart });
});

// ---- Product Listing ---- //
app.get('/product', (req, res) => {
    const sql = 'SELECT * FROM products';
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Product fetch error:', err);
            return res.status(500).send('Error retrieving products');
        }
        res.render('product', { products: results });
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
        role: user.role
    });
});

// ---- Search ---- //
app.get('/search', (req, res) => {
    res.render('search-results', {
        searchQuery: req.query.q || '',
        categories: ['Women', 'Men', 'Baby']
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
    res.render('register', { formData: {}, errors: [] }); // No error on GET
});

app.post('/register', upload.single('profilepic'), (req, res) => {
    const { username, email, password, gender, address, contact, firstname, lastname, role } = req.body;
    const profilepic = req.file ? req.file.filename : 'default.png';

    // First, check if the email already exists
    connection.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
        if (err) {
            console.error('Registration error:', err);
            return res.status(500).send('Error checking user');
        }
        if (results.length > 0) {
            // Email exists
            return res.render('register', { formData: req.body, errors: ['Email already exists'] });
        }

        // If not, insert the new user
        const sql = 'INSERT INTO users (username, email, password, gender, address, contact, firstname, lastname, role, profilepic) VALUES (?, ?, SHA1(?), ?, ?, ?, ?, ?, ?, ?)';
        connection.query(sql, [username, email, password, gender, address, contact, firstname, lastname, role, profilepic], (err, result) => {
            if (err) {
                console.error('Registration error:', err);
                return res.render('register', { formData: req.body, errors: ['Registration failed'] });
            }
            req.session.user = { username, email, gender, address, contact, firstname, lastname, role, profilepic };
            res.render('register-success', { username });
        });
    });
});

// ---- Login ---- //
app.get('/login', (req, res) => {
    // If the user is already logged in, redirect them to the homepage instead of /user
    if (req.session.user) {
        return res.redirect('/'); // Changed from '/user' to '/'
    }
    res.render('login', { errors: [], messages: [] });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    const sql = 'SELECT * FROM users WHERE email = ? AND password = SHA1(?)';
    connection.query(sql, [email, password], (err, results) => {
        if (err) {
            console.error("Login database error:", err); // Add error logging for debugging
            return res.status(500).send('Login error');
        }
        if (results.length === 0) {
            return res.render('login', { errors: ['Invalid email or password'], messages: [] });
        }
        req.session.user = results[0];
        // After successful login, redirect to the homepage instead of /user
        res.redirect('/'); // Changed from '/user' to '/'
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
        formData: req.flash('formData')[0] || {}
    });
});


// ---- Add Product (POST) ---- //
app.post('/addProduct', upload.single('image'), (req, res) => {
    const { productName, quantity, price, description } = req.body;
    const image = req.file ? req.file.filename : null;

    const sql = 'INSERT INTO products (productName, quantity, price, image, description) VALUES (?, ?, ?, ?, ?)';
    connection.query(sql, [productName, quantity, price, image, description], (err, result) => {
        if (err) {
            console.error('Add product error:', err);
            // Clean up the uploaded file if database insertion fails
            if (req.file) {
                fs.unlink(req.file.path, (unlinkErr) => {
                    if (unlinkErr) console.error('Error deleting uploaded file on DB error:', unlinkErr);
                });
            }
            // Place the requested render here
            return res.render('addProduct', {
                errors: ['Error adding product: Please try again.'], // Example error message
                success: "",
                formData: req.body
            });
        }
        res.redirect('/product');
    });
});


// ---- Edit Product ---- //
app.post('/editProduct/:id', upload.single('image'), (req, res) => {
    const { productName, quantity, price, description, currentImage } = req.body;
    const image = req.file ? req.file.filename : currentImage;
    const productId = req.params.id;

    const sql = 'UPDATE products SET productName = ?, quantity = ?, price = ?, image = ?, description = ? WHERE productId = ?';
    connection.query(sql, [productName, quantity, price, image, description, productId], (err, result) => {
        if (err) {
            console.error('Edit product error:', err);
            return res.status(500).send('Error editing product');
        }
        res.redirect('/product');
    });
});

// --- GET route for the Sell Item form ---
app.get('/sell', (req, res) => {
    // 1. Check if the user is logged in
    if (!req.session.user) {
        req.flash('error', 'Please log in to sell an item.');
        return res.redirect('/login'); // Redirect to login if not authenticated
    }

    // 2. Render the sell form (your 'sell.ejs' file)
    res.render('sell', {
        // Pass flash messages to the template (requires 'connect-flash' middleware)
        messages: res.locals.messages,
        // Pass back previously submitted form data in case of validation error
        // The [0] is because req.flash returns an array.
        formData: req.flash('formData')[0] || {}
    });
});

// ---- Start Server ---- //
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🧵 Seam & Soul app running at http://localhost:${PORT}!`);
});
