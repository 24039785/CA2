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
        res.redirect('______');
    }
};

// Middleware for form validation
const validateRegistration = (req, res, next) => {
    const { _______, _______, _______, _______, _______ } = req.body;

    if (!_______ || !_______ || !_______ || !_______ || !_______) {
        return res.status(400).send('All fields are required.');
    }
    
    if (password.length < 6) {
        req.flash('error', 'Password should be at least 6 or more characters long');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    next();
};

//******** TODO: Integrate validateRegistration into the register route. ********//
app.post('/register', validateRegistration, (req, res) => {
    //******** TODO: Update register route to include role. ********//
    const { username, email, password, address, contact, role } = req.body;

    const sql = 'INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, SHA1(?), ?, ?, ?)';
    db.query(sql, [username, email, password, address, contact, role], (err, result) => {
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

    const sql = 'SELECT * FROM users WHERE _____ = ? AND password = SHA1(?)';
    db.query(sql, [_______, password], (err, results) => {
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
app.get('/dashboard', checkAuthenticated, (req, res) => {
    res.render('dashboard', {user: req.session.user});
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

// Starting the server
app.listen(3000, () => {
    console.log('Server started on port 3000');
});