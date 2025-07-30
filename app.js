const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');
const flash = require('connect-flash');
const methodOverride = require('method-override'); // REQUIRED for DELETE forms
const router = express.Router();


const app = express();

app.use(session({
    secret: 'yourSecretKey',
    resave: false,
    saveUninitialized: false
}));
app.use(flash());

// ---- MySQL Connection Pool ---- //
const pool = mysql.createPool({
    host: 'c237-all.mysql.database.azure.com',
    user: 'c237admin',
    password: 'c2372025!',
    database: 'c237_clothingstoreapp',
    port: 3306,
    ssl: { rejectUnauthorized: true },
    waitForConnections: true,
    connectionLimit: 10, // Max number of connections in the pool
    queueLimit: 0 // No limit to the number of requests queued
});

pool.getConnection((err, connection) => {
    if (err) {
        console.error('❌ MySQL connection pool failed to get a connection:', err);
        process.exit(1);
    }
    console.log('✅ Connected to MySQL database via pool');
    if (connection) connection.release();
});

pool.on('error', err => {
    console.error('❌ MySQL Pool Error:', err.code);
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

app.use(express.urlencoded({ extended: true })); // Must be before methodOverride
app.use(express.json());
app.use(methodOverride('_method')); // Use method-override after body parsers
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

function requireLogin(req, res, next) {
    if (!req.session.user) return res.redirect('/login');
    next();
}

app.get('/', (req, res) => {
    res.render('index', { categories: ['Women', 'Men', 'Baby', 'Kids'] });
});

// Category routes
app.get('/category/:category', (req, res) => {
  const categoryName = req.params.category();
  const validCategories = ['women', 'men', 'kids', 'baby'];

  if (!validCategories.includes(categoryName)) {
    return res.status(404).send('Category not found');
  }

  // Capitalize first letter for the template
  const category = categoryName.charAt(0).toUpperCase() + categoryName.slice(1);

  res.render('category', { category, user: req.user });
});

app.get('/women', (req, res) => {
    const categoryName = 'Women';
    const sql = 'SELECT * FROM products WHERE category = ?';
    pool.query(sql, [categoryName], (err, products) => {
        if (err) {
            console.error('Error fetching women\'s products:', err);
            return res.status(500).send('Error retrieving products for Women\'s category');
        }
        res.render('category', { category: categoryName, products, user: req.session.user });
    });
});

app.get('/men', (req, res) => {
    const categoryName = 'Men';
    const sql = 'SELECT * FROM products WHERE category = ?';
    pool.query(sql, [categoryName], (err, products) => {
        if (err) {
            console.error('Error fetching men\'s products:', err);
            return res.status(500).send('Error retrieving products for Men\'s category');
        }
        res.render('category', { category: categoryName, products, user: req.session.user });
    });
});

app.get('/kids', (req, res) => {
    const categoryName = 'Kids';
    const sql = 'SELECT * FROM products WHERE category = ?';
    pool.query(sql, [categoryName], (err, products) => {
        if (err) {
            console.error('Error fetching kids\' products:', err);
            return res.status(500).send('Error retrieving products for Kids\' category');
        }
        res.render('category', { category: categoryName, products, user: req.session.user });
    });
});

app.get('/baby', (req, res) => {
    const categoryName = 'Baby';
    const sql = 'SELECT * FROM products WHERE category = ?';
    pool.query(sql, [categoryName], (err, products) => {
        if (err) {
            console.error('Error fetching baby\'s products:', err);
            return res.status(500).send('Error retrieving products for Baby\'s category');
        }
        res.render('category', { category: categoryName, products, user: req.session.user });
    });
});

// Product route that redirects to products
app.get('/product', (req, res) => {
    res.redirect('/products');
});

app.get('/products', (req, res) => {
    const { category, type } = req.query;
    let sql = 'SELECT * FROM products WHERE 1=1';
    const params = [];
    if (category) {
        sql += ' AND category = ?';
        params.push(category);
    }
    if (type) {
        sql += ' AND type = ?';
        params.push(type);
    }
    pool.query(sql, params, (err, products) => {
        if (err) {
            console.error('Error fetching filtered products:', err);
            return res.status(500).send('Error retrieving filtered products');
        }
        res.render('filteredProducts', {
            category: category || 'All Categories',
            type: type || 'All Types',
            products: products,
            user: req.session.user
        });
    });
});

app.get('/product/:productId', (req, res) => {
    const productId = req.params.productId;
    const sql = 'SELECT * FROM products WHERE productId = ?';
    pool.query(sql, [productId], (err, results) => {
        if (err) {
            console.error('Error fetching single product:', err);
            return res.status(500).send('Error retrieving product details');
        }
        if (results.length > 0) {
            res.render('productDetail', { product: results[0], user: req.session.user });
        } else {
            res.status(404).send('Product not found');
        }
    });
});

app.get('/addProduct', (req, res) => {
    res.render('addProduct', {
        errors: req.flash('errors') || [],
        success: req.flash('success') || "",
        formData: req.flash('formData')[0] || {},
        user: req.session.user
    });
});

app.post('/addProduct', upload.single('image'), (req, res) => {
    const { productName, category, type, quantity, price, description } = req.body;
    const image = req.file ? req.file.filename : null;

    const sql = 'INSERT INTO products (productName, category, type, quantity, price, image, description) VALUES (?, ?, ?, ?, ?, ?, ?)';
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
        // ✅ Redirect to category page after successful insertion
        res.redirect(`/category/${category}/${encodeURIComponent(type)}`);
    });
});

//Delete product
app.get('/products/:id/deleteProduct', (req, res) => {
    const productId = req.params.id;

    const sql = 'SELECT * FROM products WHERE productId = ?';
    pool.query(sql, [productId], (err, results) => {
        if (err) return res.status(500).send('Database error');
        if (results.length === 0) return res.status(404).send('Product not found');

        const product = results[0]; // Changed to singular 'product'
        res.render('deleteProduct', { product }); // match with your ejs file
    });
});

app.delete('/type-products/:id', (req, res) => {
    const productId = req.params.id;
    console.log('Deleting productId:', productId);

    pool.query('DELETE FROM products WHERE productId = ?', [productId], (err, result) => {
        if (err) {
            console.error('Error deleting product:', err);
            return res.status(500).send('Failed to delete product');
        }

        if (result.affectedRows === 0) {
            return res.status(404).send('Product not found to delete');
        }

        req.flash('success', 'Product deleted successfully!');
        res.redirect('/');
    });
});


//Edit product
app.get('/products/:id/edit', (req, res) => {
    const productId = req.params.id;
    const sql = 'SELECT * FROM products WHERE productId = ?';
    pool.query(sql, [productId], (err, results) => {
        if (err) return res.status(500).send('Database error');
        if (results.length === 0) return res.status(404).send('Product not found');
        res.render('edit', { product: results[0] });
    });
});

app.post('/products/:id/edit', upload.single('image'), (req, res) => {
    const productId = req.params.id;
    const { name, quantity, price, description, currentImage } = req.body;
    const image = req.file ? req.file.filename : currentImage;

    const sql = `UPDATE products SET productName=?, quantity=?, price=?, description=?, image=? WHERE productId = ?`;

    pool.query(sql, [name, quantity, price, description, image, productId], (err, result) => {
        if (err) {
            console.error('Error editing product:', err);
            return res.status(500).send('Error editing product');
        }
        if (result.affectedRows === 0) {
            return res.status(404).send('Product not found');
        }

        req.flash('success', 'Product updated successfully!');
        res.redirect('/products');
    });
});

// Edit Added Products (This route was causing the 'connection' error)
app.get('/edit/:id', (req, res) => {
    const productId = req.params.id;

    pool.query('SELECT * FROM products WHERE productId = ?', [productId], (err, results) => { // Corrected 'id' to 'productId'
        if (err) {
            console.error('Error fetching product for edit:', err);
            return res.status(500).send('Database error: Could not retrieve product for editing.');
        }

        if (results.length === 0) {
            return res.status(404).send('Product not found');
        }

        res.render('edit', { product: results[0] });
        // Removed: res.redirect(`/category/${category}`); // This line would cause an error (headers already sent)
    });
});

app.post('/edit/:id', upload.single('image'), (req, res) => {
    const id = req.params.id;

    const productName = req.body.productName;
    const category = req.body.category;
    const type = req.body.type; // Added type here
    const price = req.body.price;
    const quantity = req.body.quantity;
    const description = req.body.description;

    // Optional: update image if uploaded
    let sql;
    let params;

    if (req.file) {
        const image = req.file.filename;
        sql = 'UPDATE products SET productName = ?, category = ?, type = ?, price = ?, quantity = ?, description = ?, image = ? WHERE productId = ?'; // Added type to SQL
        params = [productName, category, type, price, quantity, description, image, id]; // Added type to params
    } else {
        sql = 'UPDATE products SET productName = ?, category = ?, type = ?, price = ?, quantity = ?, description = ? WHERE productId = ?'; // Added type to SQL
        params = [productName, category, type, price, quantity, description, id]; // Added type to params
    }

    pool.query(sql, params, (err, result) => { // Corrected 'connection.query' to 'pool.query'
        if (err) {
            console.error("Error updating product:", err);
            req.flash('error', 'Failed to edit product'); // Use flash for user feedback
            return res.redirect('/edit/' + id); // Redirect back to edit page with error
        }

        if (result.affectedRows === 0) {
            req.flash('error', 'Product not found for update.');
            return res.redirect('/edit/' + id);
        }

        req.flash('success', 'Product updated successfully!');
        res.redirect(`/category/${category}/${encodeURIComponent(type)}`); // Redirect to the specific category/type page
    });
});


// Favorites
app.get('/favorites', (req, res) => {
    res.render('favorites', {
        user: req.session.user
    });
});

// Cart
app.get('/cart', (req, res) => {
    const cart = req.session.cart || [];
    res.render('cart', {
        user: req.session.user,
        cart: cart
    });
});

app.get('/register', (req, res) => {
    res.render('register', { formData: {}, errors: [], user: req.session.user });
});

app.post('/register', upload.single('profilepic'), (req, res) => {
    const { username, email, password, gender, address, contact, firstname, lastname, role } = req.body;
    const profilepic = req.file ? req.file.filename : 'default.png';

    pool.query('SELECT * FROM users WHERE email = ?', [email], (err, results) => {
        if (err) {
            console.error('Registration error:', err);
            return res.status(500).send('Error checking user');
        }
        if (results.length > 0) {
            return res.render('register', { formData: req.body, errors: ['Email already exists'], user: req.session.user });
        }
        const sql = 'INSERT INTO users (username, email, password, gender, address, contact, firstname, lastname, role, profilepic) VALUES (?, ?, SHA1(?), ?, ?, ?, ?, ?, ?, ?)';
        pool.query(sql, [username, email, password, gender, address, contact, firstname, lastname, role, profilepic], (err, result) => {
            if (err) {
                console.error('Registration error:', err);
                return res.render('register', { formData: req.body, errors: ['Registration failed'], user: req.session.user });
            }
            req.session.user = { username, email, gender, address, contact, firstname, lastname, role, profilepic };
            res.render('register-success', { username, user: req.session.user });
        });
    });
});

app.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/');
    }
    res.render('login', { errors: [], messages: [], user: req.session.user });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;
    const sql = 'SELECT * FROM users WHERE email = ? AND password = SHA1(?)';
    pool.query(sql, [email, password], (err, results) => {
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

app.get('/logout', (req, res) => {
    req.session.destroy(() => res.redirect('/login'));
});

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
        user: req.session.user
    });
});

// Edit User
app.get('/editUser/:id', (req, res) => {
    const userId = req.params.id;

    const sql = 'SELECT * FROM users WHERE userId = ?';
    pool.query(sql, [userId], (err, results) => {
        if (err) {
            console.error('Error fetching user for edit:', err);
            return res.status(500).send('Database error: Could not retrieve user for editing.');
        }
        if (results.length === 0) {
            return res.status(404).send('User not found.');
        }
        res.render('editUser', { user: results[0] });
    });
});

app.post('/editUser/:id', upload.single('profilepic'), (req, res) => {
    const userId = req.params.id;
    const { username, email, password, currentprofilepic } = req.body;
    const profilepic = req.file ? req.file.filename : currentprofilepic;

    const sql = `UPDATE users SET username=?, email=?, password=?, profilepic=? WHERE userId = ?`;

    pool.query(sql, [username, email, password, profilepic, userId], (err, result) => {
        if (err) {
            console.error('Error editing user:', err);
            return res.status(500).send('Error editing user');
        }
        if (result.affectedRows === 0) {
            return res.status(404).send('User not found');
        }

        req.flash('success', 'User updated successfully!');
        res.redirect('/user');
    });
});

app.get('/search', (req, res) => {
  let query = req.query.q;  // or req.body.query depending on method

  // For example, query your database like:
  pool.query('SELECT * FROM products WHERE productName LIKE ?', ['%' + query + '%'], function(error, results) {
    if (error) {
      // handle error, maybe send error page
    } else {
      res.render('search-results', {
        searchQuery: query,
        products: results  // send results (array) to your EJS template
      });
    }
  });
});



module.exports = router;
app.post('/search', (req, res) => {
    const q = req.body.q || '';
    res.redirect(`/search?q=${encodeURIComponent(q)}`);
});

app.post('/language', (req, res) => res.redirect('back'));

// Route to handle category/type specific product listings (e.g., /category/Women/Dresses)
app.get('/category/:category/:type', (req, res) => {
    const category = req.params.category;
    const type = req.params.type;

    pool.query(
        'SELECT * FROM products WHERE category = ? AND type = ?',
        [category, type],
        (err, results) => {
            if (err) {
                console.error('Error fetching products by category and type:', err);
                return res.status(500).send('DB error');
            }
            res.render('type-products', { // Ensure you have a 'type-products.ejs' view
                category: category,
                type: type,
                products: results,
                user: req.session.user
            });
        }
    );
});

app.get('/sell', (req, res) => {
    res.redirect('/addProduct');
});



const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🧵 Seam & Soul app running at http://localhost:${PORT}!`);
});
