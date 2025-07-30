const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const app = express();

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images'); // Directory to save uploaded files
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname); 
    }
});

const upload = multer({ storage: storage });

const connection = mysql.createConnection({
    host: 'c237-all.mysql.database.azure.com',
    port: 3306,
    user: 'c237admin',
    password: 'c2372025!',
    database: 'c237_ca2db_021_t3'
  });

connection.connect((err) => {
    if (err) {
        console.error('Error connecting to MySQL:', err);
        return;
    }
    console.log('Connected to MySQL database');
});

// Set up view engine
app.set('view engine', 'ejs');
//  enable static files
app.use(express.static('public'));
// enable form processing
app.use(express.urlencoded({
    extended: false
}));

//TO DO: Insert code for Session Middleware below 
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    // Session expires after 1 week of inactivity
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } 
}));

app.use(flash());

// Middleware to check if user is logged in
const checkAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    } else {
        req.flash('error', 'Please log in to view this resource');
        res.redirect('/login');
    }
};

const checkAdmin = (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') {
        return next();
    } else {
        req.flash('error', 'Access denied. Admins only.');
        res.redirect('/login');
    }
};

// Middleware for form validation
const validateRegistration = (req, res, next) => {
    const { username, email, password, address, contact, role } = req.body;

    // Check required fields
    if (!username || !email || !password || !address || !contact || !role) {
        req.flash('error', 'All fields are required.');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }

    // Check password length
    if (password.length < 6) {
        req.flash('error', 'Password must be at least 6 characters long.');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    next();
};

// // Define routes
// app.get('/', (req, res) => {
//     const sql = 'SELECT * FROM bookings';
//     // Fetch data from MySQL
//     connection.query (sql, (error, results) => {
//         if (error) {
//             console.error('Database query error:', error.message);
//             return res.status(500).send('Error Retrieving The Bookings, It must be something wrong with the database we apologize for the inconvinience please check again later');
//         }
//         // Render HTML page with data
//         res.render('tempIndex', { bookings: results });
//     });
// });

// //******** TODO: Insert code for dashboard route to render dashboard page for users. ********//
// app.get('/tempIndex', checkAuthenticated, (req, res) => {
//     res.render('tempIndex', {user: req.session.user});
// });

// //******** TODO: Insert code for admin route to render dashboard page for admin. ********//
// app.get('/admin', checkAuthenticated, checkAdmin, (req,res) => {
//     res.render('admin', {user: req.session.user});
// });

// Landing page
app.get('/', (req, res) => {
    res.render('landing'); // landing.ejs with "Login" and "Register" buttons
});

// Login page
app.get('/login', (req, res) => {
    res.render('login', {
        messages: req.flash('success'),  // Green success alerts
        errors: req.flash('error')       // Red error alerts
    });
});

// Register page
app.get('/register', (req, res) => {
    res.render('register', {
        messages: req.flash('success'),  // Green success alerts
        errors: req.flash('error'),      // Red error alerts
        formData: {}                     
    });
});

// handle register Submission
app.post('/register', validateRegistration, (req, res) => {
    const { username, email, password, address, contact, role } = req.body;

    // Force role to "user" for security
    const userRole = 'user';
    const sql = `INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, SHA1(?), ?, ?, ?)`;

    connection.query(sql, [username, email, password, address, contact, userRole], (err, result) => {
        if (err) {
            console.error('Registration error:', err);

            // Handle duplicate email error specifically
            if (err.code === 'ER_DUP_ENTRY') {
                req.flash('messages', ['Email is already registered. Please log in or use another email.']);
            } else {
                req.flash('messages', ['Registration failed. Please try again.']);
            }
            return res.redirect('/register');}

        console.log('User registered:', result);

        req.flash('messages', ['Registration successful! Please log in.']);
        res.redirect('/login');
    });
});

// Handle Login Submission
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    // Check for empty fields
    if (!email || !password) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/login');}

    const sql = 'SELECT * FROM users WHERE email = ? AND password = SHA1(?)';
    connection.query(sql, [email, password], (err, results) => {
        if (err) {
            console.error('Database error during login:', err);
            req.flash('error', 'An unexpected error occurred. Please try again.');
            return res.redirect('/login');}

        if (results.length > 0) {
            // User found, start a session
            req.session.user = results[0];
            req.flash('success', 'Login successful!');

            // Redirect based on role
            if (results[0].role === 'admin') {
                res.redirect('/admin');
            } else {
                res.redirect('/dashboard');
            }
        } else {
            // Invalid credentials
            req.flash('error', 'Invalid email or password.');
            res.redirect('/login');}
    });
});

app.get('/dashboard', checkAuthenticated, (req, res) => {
    const sql = 'SELECT * FROM bookings';
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Database query error:', err.message);
            return res.status(500).send('Error retrieving bookings');
        }
        res.render('dashboard', { 
            user: req.session.user,
            bookings: results
        });
    });
});

app.get('/admin', checkAuthenticated, checkAdmin, (req, res) => {
    const sql = 'SELECT * FROM bookings';
    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Database query error:', err.message);
            return res.status(500).send('Error retrieving bookings');
        }
        res.render('admin', { 
            user: req.session.user,
            bookings: results
        });
    });
});

//nash
//search hotels for admin
app.get('/AdminSearch', (req, res) => {
    const name = req.query.name;
    const roomType = req.query.roomType;

    let sql = 'SELECT * FROM bookings WHERE 1';
    const values = [];

    if (name) {
        sql += ' AND name LIKE ?';
        values.push('%' + name + '%');
    }

    if (roomType) {
        sql += ' AND roomType = ?';
        values.push(roomType);
    }

    connection.query(sql, values, (err, results) => {
        if (err) {
            console.error('Database query error:', err.message);
            return res.status(500).send('Error searching for hotels');
        }

        // Send results to your search results page
        res.render('AdminSearch', { 
            bookings: results, 
            search: name, 
            roomType: roomType
        });
    });
});

//******** TODO: Insert code for logout route ********//
app.get('/logout', (req,res) => {
    req.session.destroy();
    res.redirect('/');
});

// King
// Admin: View all users
app.get('/admin/edit-users', checkAuthenticated, checkAdmin, (req, res) => {
    const sql = 'SELECT * FROM users';
    connection.query(sql, (err, users) => {
        if (err) {
            console.error('Error retrieving users:', err);
            req.flash('error', 'Unable to fetch users.');
            return res.redirect('/admin');
        }
        res.render('userList', { users, messages: req.flash('error') });
    });
});

// Show edit form for a user
app.get('/admin/edit-user/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const userId = req.params.id;
    const sql = 'SELECT * FROM users WHERE id = ?';
    connection.query(sql, [userId], (err, results) => {
        if (err || results.length === 0) {
            req.flash('error', 'User not found.');
            return res.redirect('/admin/edit-users');
        }
        res.render('edit', { formData: results[0], messages: req.flash('error') });
    });
});


// Handle edit form submission
app.post('/edit/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const userId = req.params.id;
    const { username, email, password, address, contact, role } = req.body;

    let sql, values;

    if (password) {
        sql = `UPDATE users SET username = ?, email = ?, password = SHA1(?), address = ?, contact = ?, role = ? WHERE id = ?`;
        values = [username, email, password, address, contact, role, userId];
    } else {
        sql = `UPDATE users SET username = ?, email = ?, address = ?, contact = ?, role = ? WHERE id = ?`;
        values = [username, email, address, contact, role, userId];
    }

    connection.query(sql, values, (err, result) => {
        if (err) {
            console.error('Error updating user:', err);
            req.flash('error', 'Failed to update user.');
            return res.redirect('/admin/edit-user/' + userId);
        }

        req.flash('success', 'User updated successfully.');
        res.redirect('/admin/edit-users');
    });
});

// Edit Hotel
// Render edit hotel form
app.get('/admin/edit/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const bookingId = req.params.id;
    const sql = 'SELECT * FROM bookings WHERE bookingId = ?';

    connection.query(sql, [bookingId], (err, results) => {
        if (err || results.length === 0) {
            console.error('Error retrieving hotel:', err);
            req.flash('error', 'Hotel not found.');
            return res.redirect('/admin');
        }
        res.render('edit-hotel', { booking: results[0] });
    });
});

// Handle hotel edit form submission
app.post('/admin/edit/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const bookingId = req.params.id;
    const { name, location, roomType, image, isAvailable } = req.body;
    const availability = isAvailable ? 1 : 0;

    const sql = `UPDATE bookings 
                 SET name = ?, location = ?, roomType = ?, image = ?, isAvailable = ? 
                 WHERE bookingId = ?`;

    connection.query(sql, [name, location, roomType, image, availability, bookingId], (err, result) => {
        if (err) {
            console.error('Error updating hotel:', err);
            req.flash('error', 'Failed to update hotel.');
            return res.redirect('/admin/edit/' + bookingId);
        }

        req.flash('success', 'Hotel updated successfully.');
        res.redirect('/admin');
    });
});


// Starting the server
app.listen(3000, () => {
    console.log('Server started on port 3000');
});