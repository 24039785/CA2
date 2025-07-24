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

// Middleware to check if user is admin
const checkAdmin = (req, res, next) => {
    if (req.session.user.role === 'admin') {
        return next();
    } else {
        req.flash('error', 'Access denied');
        res.redirect('/login');
    }
};

// Middleware for form validation
const validateRegistration = (req, res, next) => {
    const { id, username, email, password, address, contact, role } = req.body;

    if (!id || !username || !email || !password || !address || !contact ||!role ) {
        return res.status(400).send('All fields are required.');
    }
    
    if (password.length < 6) {
        req.flash('error', 'Password should be at least 6 or more characters long');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    next();
};

// Define routes
app.get('/', (req, res) => {
    const sql = 'SELECT * FROM bookings';
    // Fetch data from MySQL
    connection.query (sql, (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Error Retrieving The Bookings, It must be something wrong with the database we apologize for the inconvinience please check again later');
        }
        // Render HTML page with data
        res.render('index', { bookings: results });
    });
});

//******** TODO: Integrate validateRegistration into the register route. ********//
app.post('/register', validateRegistration, (req, res) => {
    //******** TODO: Update register route to include role. ********//
    const { username, email, password, address, contact, role } = req.body;

    const sql = 'INSERT INTO users (id, username, email, password, address, contact, role) VALUES (?, ?, ?, SHA1(?), ?, ?, ?)';
    db.query(sql, [id, username, email, password, address, contact, role], (err, result) => {
        if (err) {
            throw err;
        }
        console.log(result);
        req.flash('success', 'Registration successful! Please log in.');
        res.redirect('/login');
    });
});

//******** TODO: Insert code for login routes to render login page below ********//
app.get('/login', (req,res) => {
    res.render('login', {
        messages: req.flash('success'),
        errors: req.flash('error')
    });
});

//******** TODO: Insert code for login routes for form submission below ********//
app.post('/login', (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/login');
    }

    const sql = 'SELECT * FROM users WHERE email = ? AND password = SHA1(?)';
    db.query(sql, [email, password], (err, results) => {
        if (err) {
            throw err;
        }

        if (results.length > 0) {
            req.session.user = results[0];
            req.flash('success', 'Login successful!');
            res.redirect('/dashboard');
        } else {
            req.flash('error', 'Invalid email or password.');
            res.redirect('/login');
        }
    });
});

//******** TODO: Insert code for dashboard route to render dashboard page for users. ********//
app.get('/menu', checkAuthenticated, (req, res) => {
    res.render('menu', {user: req.session.user});
});

//******** TODO: Insert code for admin route to render dashboard page for admin. ********//
app.get('/admin', checkAuthenticated, checkAdmin, (req,res) => {
    res.render('admin', {user: req.session.user });
});

//******** TODO: Insert code for logout route ********//
app.get('/logout', (req,res) => {
    req.session.destroy();
    res.redirect('/');
});

//The Delete Route
app.get('/delete', checkAuthenticated, checkAdmin, (req, res) => {
    const sql = 'SELECT id, name FROM _____';

    connection.query(sql, (err, results) => {
        if (err) {
            req.flash('error', 'Unable to fetch listing.');
            return res.redirect('/admin');
        }

        res.render('delete', {
            listings: results,
            messages: req.flash('success'),
            errors: req.flash('error')
        });
    });
});

app.post('/delete', checkAuthenticated, checkAdmin, (req, res) => {
    const _____Id = req.body._______id;

    if (!____Id) {
        req.flash('error', 'Listing ID is required.');
        return res.redirect('/delete');
    }

    const sql = 'DELETE FROM ________ WHERE id = ?';

    connection.query(sql, [listingId], (err, result) => {
        if (err) {
            req.flash('error', 'Error deleting listing.');
            return res.redirect('/delete');
        }

        if (result.affectedRows === 0) {
            req.flash('error', 'No listing found with that ID.');
        } else {
            req.flash('success', 'Listing deleted successfully.');
        }

        res.redirect('/delete');
    });
});

// Middleware: Only allow hotel owners to update their own hotels
const checkHotelOwner = (req, res, next) => {
    const hotelId = req.params.id;
    const userId = req.session.user.id;

    const sql = 'SELECT * FROM hotels WHERE id = ? AND ownerId = ?';
    connection.query(sql, [hotelId, userId], (err, results) => {
        if (err) throw err;

        if (results.length === 0) {
            req.flash('error', 'Access denied.');
            return res.redirect('/dashboard');
        }
        next();
    });
};

// Admin: Update hotel availability
app.post('/admin/hotels/:id/availability', checkAuthenticated, checkAdmin, (req, res) => {
    const hotelId = req.params.id;
    const { availableRooms } = req.body;

    const sql = 'UPDATE hotels SET availableRooms = ? WHERE id = ?';
    connection.query(sql, [availableRooms, hotelId], (err, result) => {
        if (err) throw err;

        req.flash('success', 'Availability updated.');
        res.redirect('/admin');
    });
});

// Hotel user: Update own hotel info
app.post('/hotels/:id/edit', checkAuthenticated, checkHotelOwner, upload.single('image'), (req, res) => {
    const hotelId = req.params.id;
    const { name, location, price, description } = req.body;
    const image = req.file ? `/images/${req.file.filename}` : null;

    let sql, values;
    if (image) {
        sql = 'UPDATE hotels SET name = ?, location = ?, price = ?, description = ?, image = ? WHERE id = ?';
        values = [name, location, price, description, image, hotelId];
    } else {
        sql = 'UPDATE hotels SET name = ?, location = ?, price = ?, description = ? WHERE id = ?';
        values = [name, location, price, description, hotelId];
    }

    connection.query(sql, values, (err, result) => {
        if (err) throw err;

        req.flash('success', 'Hotel information updated.');
        res.redirect('/dashboard');
    });
});


// Starting the server
app.listen(3000, () => {
    console.log('Server started on port 3000');
});