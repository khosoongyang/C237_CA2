const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const session = require('express-session');
const multer = require('multer');
const fs = require('fs');
const flash = require('connect-flash');
const methodOverride = require('method-override'); // REQUIRED for DELETE forms


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

// Middleware to check if user is logged in
function requireLogin(req, res, next) {
    if (!req.session.user) {
        req.flash('error', 'You must be logged in to access this page.');
        return res.redirect('/login');
    }
    next();
}

// Middleware to check user role
function requireRole(allowedRoles) {
    return (req, res, next) => {
        if (!req.session.user) {
            req.flash('error', 'You must be logged in to access this page.');
            return res.redirect('/login');
        }
        if (!allowedRoles.includes(req.session.user.role)) {
            req.flash('error', 'You do not have permission to access this page.');
            return res.status(403).redirect('/'); // Redirect to home or a permission denied page
        }
        next();
    };
}


app.get('/', (req, res) => {
    res.render('index', { categories: ['Women', 'Men', 'Baby', 'Kids'] });
});

// Category routes
app.get('/category/:category', (req, res) => {
    const categoryName = req.params.category;
    const validCategories = ['women', 'men', 'kids', 'baby'];

    if (!validCategories.includes(categoryName)) {
        return res.status(404).send('Category not found');
    }

    const category = categoryName.charAt(0).toUpperCase() + categoryName.slice(1);

    res.render('category', { category, user: req.session.user });
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
            res.render('product', { products: [results[0]], user: req.session.user });
        } else {
            res.status(404).send('Product not found');
        }
    });
});

// Apply requireRole middleware for adding products
app.get('/addProduct', requireRole(['seller', 'admin']), (req, res) => {
    res.render('addProduct', {
        errors: req.flash('errors') || [],
        success: req.flash('success') || "",
        formData: req.flash('formData')[0] || {},
        user: req.session.user
    });
});

app.post('/addProduct', requireRole(['seller', 'admin']), upload.single('image'), (req, res) => {
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
        res.redirect(`/`);
    });
});

//Delete product
app.get('/products/:id/deleteProduct', requireRole(['seller', 'admin']), (req, res) => {
    const productId = req.params.id;

    const sql = 'SELECT * FROM products WHERE productId = ?';
    pool.query(sql, [productId], (err, results) => {
        if (err) return res.status(500).send('Database error');
        if (results.length === 0) return res.status(404).send('Product not found');

        const product = results[0];
        res.render('deleteProduct', { product });
    });
});

app.delete('/products/:id', requireRole(['seller', 'admin']), (req, res) => {
    const productId = req.params.id;
    console.log('Attempting to delete productId:', productId);

    pool.query('DELETE FROM products WHERE productId = ?', [productId], (err, result) => {
        if (err) {
            console.error('Error deleting product:', err);
            req.flash('error', 'Failed to delete product.');
            return res.status(500).redirect('/products/' + productId + '/deleteProduct');
        }

        if (result.affectedRows === 0) {
            console.warn(`Attempted to delete product ID ${productId}, but it was not found.`);
            req.flash('error', 'Product not found to delete.');
            return res.status(404).redirect('/products');
        }

        req.flash('success', 'Product deleted successfully!');
        res.redirect('/products');
    });
});


//Edit product
app.get('/products/:id/edit', requireRole(['seller', 'admin']), (req, res) => {
    const productId = req.params.id;
    const sql = 'SELECT * FROM products WHERE productId = ?';
    pool.query(sql, [productId], (err, results) => {
        if (err) return res.status(500).send('Database error');
        if (results.length === 0) return res.status(404).send('Product not found');
        res.render('edit', { product: results[0] });
    });
});

app.post('/products/:id/edit', requireRole(['seller', 'admin']), upload.single('image'), (req, res) => {
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
app.get('/edit/:id', requireRole(['seller', 'admin']), (req, res) => {
    const productId = req.params.id;

    pool.query('SELECT * FROM products WHERE productId = ?', [productId], (err, results) => {
        if (err) {
            console.error('Error fetching product for edit:', err);
            return res.status(500).send('Database error: Could not retrieve product for editing.');
        }

        if (results.length === 0) {
            return res.status(404).send('Product not found');
        }

        res.render('edit', { product: results[0] });
    });
});

app.post('/edit/:id', requireRole(['seller', 'admin']), upload.single('image'), (req, res) => {
    const id = req.params.id;

    const productName = req.body.productName;
    const category = req.body.category;
    const type = req.body.type;
    const price = req.body.price;
    const quantity = req.body.quantity;
    const description = req.body.description;

    let sql;
    let params;

    if (req.file) {
        const image = req.file.filename;
        sql = 'UPDATE products SET productName = ?, category = ?, type = ?, price = ?, quantity = ?, description = ?, image = ? WHERE productId = ?';
        params = [productName, category, type, price, quantity, description, image, id];
    } else {
        sql = 'UPDATE products SET productName = ?, category = ?, type = ?, price = ?, quantity = ?, description = ? WHERE productId = ?';
        params = [productName, category, type, price, quantity, description, id];
    }

    pool.query(sql, params, (err, result) => {
        if (err) {
            console.error("Error updating product:", err);
            req.flash('error', 'Failed to edit product');
            return res.redirect('/edit/' + id);
        }

        if (result.affectedRows === 0) {
            req.flash('error', 'Product not found for update.');
            return res.redirect('/edit/' + id);
        }

        req.flash('success', 'Product updated successfully!');
        res.redirect(`/category/${category}/${encodeURIComponent(type)}`);
    });
});


// Favorites
 app.get('/favorites', (req, res) => {
    res.render('favorites', {
        user: req.session.user,
        favorites: req.session.user?.favorites
    });
 });



app.post('/products/:productId/toggle-favorite', (req, res) => {
  const { productId } = req.params;
  const userId = req.session.userId;

  pool.query(
    'SELECT * FROM favorites WHERE userId = ? AND productId = ?',
    [userId, productId],
    (err, results) => {
      if (err) {
        console.error('SELECT error:', err.message);
        return res.status(500).send('Server error');
      }

      if (results.length > 0) {
        pool.query(
          'DELETE FROM favorites WHERE userId = ? AND productId = ?',
          [userId, productId],
          (err2) => {
            if (err2) {
              console.error('DELETE error:', err2.message);
              return res.status(500).send('Error removing favorite');
            }
            res.redirect('/favorites');
          }
        );
      } else {
        pool.query(
          'INSERT INTO favorites (userId, productId) VALUES (?, ?)',
          [userId, productId],
          (err3) => {
            if (err3) {
              console.error('INSERT error:', err3.message);
              return res.status(500).send('Error adding favorite');
            }
            res.redirect('/favorites');
          }
        );
      }
    }
  );
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
app.get('/editUser/:id', requireRole(['admin']), (req, res) => { // Only admin can edit users
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

app.post('/editUser/:id', requireRole(['admin']), upload.single('profilepic'), (req, res) => { // Only admin can edit users
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
    let query = req.query.q;

    pool.query('SELECT * FROM products WHERE productName LIKE ?', ['%' + query + '%'], function(error, results) {
        if (error) {
            console.error("Search error:", error);
            return res.status(500).send('Error performing search');
        } else {
            res.render('search-results', {
                searchQuery: query,
                products: results,
                user: req.session.user
            });
        }
    });
});

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
            };
            res.render('type-products', {
                category: category,
                type: type,
                products: results,
                user: req.session.user, // Ensure user is passed here
                requireRole: req.session.user ? req.session.user.role : ''
            });
        }
    );
});

// Apply requireRole middleware to the /sell route
app.get('/sell', requireRole(['seller', 'admin']), (req, res) => {
    res.redirect('/addProduct');
});

app.post('/products/:id/toggle-favorite', (req, res) => {
  if (!req.session.user) {
    return res.status(401).json({ success: false, message: 'Please log in first' });
  }
  const productId = req.params.id;
  const userId = req.session.userId;

  // ✅ Check if this favorite already exists
  pool.query(
    'SELECT * FROM favorites WHERE userId = ? AND productId = ?',
    [userId, productId],
    (selectErr, selectResults) => {
      if (selectErr) {
        console.error('SELECT error:', selectErr.message);
        return res.status(500).send('Server error while checking favorites.');
      }

      if (selectResults.length > 0) {
        // Already in favorites — redirect anyway
        return res.redirect('/favorites');
      }

      // ✅ Not in favorites yet — insert it
      pool.query(
        'INSERT INTO favorites (userId, productId) VALUES (?, ?)',
        [userId, productId],
        (insertErr, insertResults) => {
          if (insertErr) {
            console.error('Insert error:', insertErr.message);
            return res.status(500).send('Server error while adding favorite.');
          }

          res.redirect('/favorites');
        }
      );
    }
  );
});

//Remove from facvorites 
app.post('/products/:productId/unfavorite', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.redirect('/login');
    }

    const { productId } = req.params;
    const { userId } = req.session.user;

    await pool.promise().query(
      'DELETE FROM favorites WHERE userId = ? AND productId = ?',
      [userId, productId]
    );

    req.flash('success', 'Removed from favorites');
    res.redirect('back');
    
  } catch (error) {
    console.error('Unfavorite error:', error);
    req.flash('error', 'Failed to remove favorite');
    res.status(500).redirect('back');
  }
});


app.get('/favorites', (req, res) => {
  const userId = req.session.userId;

  pool.query(
    'SELECT * FROM products JOIN favorites ON products.productId = favorites.productId WHERE favorites.userId = ?',
    [userId],
    (err, products) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Something went wrong');
        
      }
      res.render('favorites', { favorites: products, user: req.session.user });
    }
  );
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🧵 Seam & Soul app running at http://localhost:${PORT}!`);
});
